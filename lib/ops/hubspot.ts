import 'server-only'

import { getHubSpotConfig } from './config'
import { logger } from './logger'
import { normalizePhone, stripHtml } from './utils'

const HUBSPOT_BASE_URL = 'https://api.hubapi.com'

export class HubSpotApiError extends Error {
  status: number
  payload: unknown

  constructor(message: string, status: number, payload: unknown) {
    super(message)
    this.name = 'HubSpotApiError'
    this.status = status
    this.payload = payload
  }
}

export type HubSpotDeliveryIdentifier = {
  type?: string
  value?: string
}

export type HubSpotParticipant = {
  actorId?: string
  name?: string
  deliveryIdentifier?: HubSpotDeliveryIdentifier
}

export type HubSpotMessage = {
  id: string
  conversationsThreadId: string
  createdAt: string
  updatedAt?: string
  createdBy?: string
  client?: { clientType?: string }
  senders?: HubSpotParticipant[]
  recipients?: HubSpotParticipant[]
  archived?: boolean
  text?: string | null
  richText?: string | null
  attachments?: unknown[]
  truncationStatus?: string
  status?: string
  direction?: string
  channelId?: string
  channelAccountId?: string
  type?: string
}

export type HubSpotThread = {
  id: string
  createdAt: string
  closedAt?: string
  status?: string
  originalChannelId?: string
  originalChannelAccountId?: string
  latestMessageTimestamp?: string
  latestMessageSentTimestamp?: string
  latestMessageReceivedTimestamp?: string
  assignedTo?: string
  spam?: boolean
  inboxId?: string
  associatedContactId?: string
  archived?: boolean
}

type HubSpotListResponse<T> = {
  results?: T[]
  paging?: {
    next?: {
      after?: string
      link?: string
    }
  }
}

type HubSpotContactResponse = {
  id: string
  properties?: {
    phone?: string | null
    mobilephone?: string | null
    firstname?: string | null
    lastname?: string | null
    email?: string | null
  }
}

async function sleep(ms: number) {
  await new Promise(resolve => setTimeout(resolve, ms))
}

function parseBody(text: string) {
  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

async function hubspotRequest<T>(path: string, init?: RequestInit, attempt = 1): Promise<T> {
  const { HUBSPOT_ACCESS_TOKEN } = getHubSpotConfig()

  const response = await fetch(`${HUBSPOT_BASE_URL}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${HUBSPOT_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  const text = await response.text()
  const payload = parseBody(text)

  if (!response.ok) {
    if ([429, 500, 502, 503, 504].includes(response.status) && attempt < 3) {
      const delayMs = 400 * attempt
      logger.warn('hubspot.retry', {
        status: response.status,
        path,
        attempt,
        delayMs,
      })
      await sleep(delayMs)
      return hubspotRequest<T>(path, init, attempt + 1)
    }

    throw new HubSpotApiError(`HubSpot request failed for ${path}`, response.status, payload)
  }

  return payload as T
}

export async function listHubSpotThreads(limit = 20, after?: string) {
  const search = new URLSearchParams({ limit: String(limit) })
  if (after) search.set('after', after)

  const payload = await hubspotRequest<HubSpotListResponse<HubSpotThread>>(
    `/conversations/v3/conversations/threads?${search.toString()}`,
  )

  return payload.results ?? []
}

export async function listHubSpotMessages(threadId: string, limit = 50) {
  const search = new URLSearchParams({ limit: String(limit) })

  const payload = await hubspotRequest<HubSpotListResponse<HubSpotMessage>>(
    `/conversations/v3/conversations/threads/${threadId}/messages?${search.toString()}`,
  )

  return payload.results ?? []
}

export async function addHubSpotThreadComment(threadId: string, text: string) {
  const payload = await hubspotRequest<HubSpotMessage>(
    `/conversations/v3/conversations/threads/${threadId}/messages`,
    {
      method: 'POST',
      body: JSON.stringify({
        type: 'COMMENT',
        text,
        richText: `<p>${text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</p>`,
      }),
    },
  )

  return payload
}

export async function getHubSpotContact(contactId: string) {
  const payload = await hubspotRequest<HubSpotContactResponse>(
    `/crm/v3/objects/contacts/${contactId}?properties=phone,mobilephone,firstname,lastname,email`,
  )

  const properties = payload.properties ?? {}
  const displayName = [properties.firstname, properties.lastname].filter(Boolean).join(' ').trim()

  return {
    id: payload.id,
    phone: normalizePhone(properties.mobilephone ?? properties.phone),
    displayName: displayName || properties.email || null,
    email: properties.email ?? null,
  }
}

function firstPhone(participants: HubSpotParticipant[] | undefined) {
  for (const participant of participants ?? []) {
    const phone = normalizePhone(participant.deliveryIdentifier?.value)
    if (phone) return phone
  }

  return null
}

function firstName(participants: HubSpotParticipant[] | undefined) {
  for (const participant of participants ?? []) {
    const name = participant.name?.trim()
    if (name) return name
  }

  return null
}

export function getMessageCustomerPhone(message: HubSpotMessage) {
  if (message.direction === 'INCOMING') {
    return firstPhone(message.senders)
  }

  if (message.direction === 'OUTGOING') {
    return firstPhone(message.recipients)
  }

  return firstPhone(message.senders) ?? firstPhone(message.recipients)
}

export function getMessageActorPhone(message: HubSpotMessage) {
  if (message.direction === 'OUTGOING') {
    return firstPhone(message.senders)
  }

  return firstPhone(message.recipients)
}

export function getMessageDisplayName(message: HubSpotMessage) {
  return firstName(message.senders) ?? firstName(message.recipients)
}

export function getMessageText(message: HubSpotMessage) {
  const plain = message.text?.trim()
  if (plain) return plain

  const rich = message.richText?.trim()
  if (rich) return stripHtml(rich)

  return ''
}
