import 'server-only'

import { PostgrestError } from '@supabase/supabase-js'

import type { CustomerRow, MessageRow, Database } from './database.types'
import {
  addHubSpotThreadComment,
  getHubSpotContact,
  getMessageCustomerPhone,
  getMessageDisplayName,
  getMessageText,
  listHubSpotMessages,
  listHubSpotThreads,
  type HubSpotMessage,
  type HubSpotThread,
} from './hubspot'
import { logger } from './logger'
import { getSupabaseAdmin } from './supabase'
import {
  joinGroupedText,
  makeGroupKey,
  makePlaceholderName,
  normalizePhone,
} from './utils'
import { getRuntimeConfig } from './config'

type SyncOptions = {
  threadLimit?: number
  messageLimit?: number
  requestId?: string
}

type MessageRowWithCustomer = MessageRow & {
  customer: CustomerRow | null
}

type OrderRowWithCustomer = Database['public']['Tables']['orders']['Row'] & {
  customer: CustomerRow | null
}

type TicketStatus = 'open' | 'ordered' | 'portal_loaded' | 'resolved_no_order'

type CustomerTicketSummary = {
  groupKey: string
  threadId: string
  previewText: string
  lastMessageAt: string
  receivedAt: string
  messageCount: number
  orderId: string | null
  orderStatus: string | null
  portalLoaded: boolean
  status: TicketStatus
}

type CustomerInboxSummary = CustomerRow & {
  ticketCount: number
  openTicketCount: number
  lastActivityAt: string | null
  lastPreviewText: string | null
  latestTicket: CustomerTicketSummary | null
  tickets: CustomerTicketSummary[]
}

function mapDirection(direction: string | undefined): MessageRow['direction'] {
  if (direction === 'INCOMING') return 'inbound'
  if (direction === 'OUTGOING') return 'outbound'
  return 'internal'
}

function isDuplicateError(error: PostgrestError | null) {
  return error?.code === '23505'
}

function throwIfError(error: PostgrestError | null, message: string): asserts error is null {
  if (!error) return
  throw new Error(`${message}: ${error.message}`)
}

function getTicketStatus(
  messages: MessageRow[],
  order: Database['public']['Tables']['orders']['Row'] | null,
): TicketStatus {
  if (order?.portal_loaded) return 'portal_loaded'
  if (order) return 'ordered'

  const isResolved = messages.length > 0 && messages.every(item => Boolean(item.resolved_at))

  if (isResolved) return 'resolved_no_order'
  return 'open'
}

function summarizeCustomerTickets(
  customer: CustomerRow,
  messages: MessageRow[],
  orders: Database['public']['Tables']['orders']['Row'][],
): CustomerInboxSummary {
  const orderByGroup = new Map(
    orders
      .filter(order => order.source_group_key)
      .map(order => [String(order.source_group_key), order] as const),
  )

  const groupedMessages = new Map<string, MessageRow[]>()

  for (const message of messages) {
    if (!message.group_key) continue
    const current = groupedMessages.get(message.group_key)
    if (current) {
      current.push(message)
      continue
    }
    groupedMessages.set(message.group_key, [message])
  }

  const tickets = Array.from(groupedMessages.entries())
    .map(([groupKey, groupMessages]) => {
      const sorted = [...groupMessages].sort(
        (a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime(),
      )
      const first = sorted[0]
      const last = sorted[sorted.length - 1]
      const order = orderByGroup.get(groupKey) ?? null

      return {
        groupKey,
        threadId: first.hubspot_thread_id,
        previewText: first.grouped_text ?? joinGroupedText(sorted.map(item => item.raw_text)),
        lastMessageAt: last.received_at,
        receivedAt: first.received_at,
        messageCount: sorted.length,
        orderId: order?.id ?? null,
        orderStatus: order?.status ?? null,
        portalLoaded: Boolean(order?.portal_loaded),
        status: getTicketStatus(sorted, order),
      } satisfies CustomerTicketSummary
    })
    .sort((a, b) => {
      const aPriority = a.status === 'open' ? 0 : 1
      const bPriority = b.status === 'open' ? 0 : 1

      if (aPriority !== bPriority) return aPriority - bPriority
      return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    })

  const ticketCount = tickets.length
  const openTicketCount = tickets.filter(ticket => ticket.status === 'open').length
  const latestTicket =
    [...tickets].sort(
      (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
    )[0] ?? null

  return {
    ...customer,
    ticketCount,
    openTicketCount,
    lastActivityAt: latestTicket?.lastMessageAt ?? null,
    lastPreviewText: latestTicket?.previewText ?? null,
    latestTicket,
    tickets,
  }
}

async function getCustomerByPhone(phone: string) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('phone', phone)
    .maybeSingle()

  throwIfError(error, 'No se pudo buscar cliente por teléfono')

  return data ?? null
}

async function createCustomer(input: {
  phone: string
  displayName: string
  razonSocial?: string | null
  hubspotContactId?: string | null
  status?: CustomerRow['status']
}) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('customers')
    .insert({
      phone: input.phone,
      display_name: input.displayName,
      razon_social: input.razonSocial ?? null,
      hubspot_contact_id: input.hubspotContactId ?? null,
      status: input.status ?? 'new',
    })
    .select('*')
    .single()

  if (isDuplicateError(error)) {
    const existing = await getCustomerByPhone(input.phone)
    if (existing) return existing
  }

  throwIfError(error, 'No se pudo crear cliente')

  return data
}

async function ensureCustomerByPhone(input: {
  phone: string
  displayName?: string | null
  hubspotContactId?: string | null
}) {
  const normalizedPhone = normalizePhone(input.phone)
  if (!normalizedPhone) return null

  const current = await getCustomerByPhone(normalizedPhone)
  const nextDisplayName = makePlaceholderName(normalizedPhone, input.displayName)

  if (!current) {
    return createCustomer({
      phone: normalizedPhone,
      displayName: nextDisplayName,
      hubspotContactId: input.hubspotContactId,
      status: 'new',
    })
  }

  const patches: Database['public']['Tables']['customers']['Update'] = {}
  const currentIsPlaceholder = current.display_name.startsWith('Cliente ')

  if (currentIsPlaceholder && input.displayName?.trim()) {
    patches.display_name = input.displayName.trim()
  }

  if (!current.hubspot_contact_id && input.hubspotContactId) {
    patches.hubspot_contact_id = input.hubspotContactId
  }

  if (!Object.keys(patches).length) {
    return current
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('customers')
    .update(patches)
    .eq('id', current.id)
    .select('*')
    .single()

  throwIfError(error, 'No se pudo actualizar cliente')

  return data
}

async function collectKnownMessageIds(messageIds: string[]) {
  if (!messageIds.length) return new Set<string>()

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('messages')
    .select('hubspot_message_id')
    .in('hubspot_message_id', messageIds)

  throwIfError(error, 'No se pudo revisar mensajes existentes')

  return new Set((data ?? []).map(item => String(item.hubspot_message_id)))
}

async function regroupThread(threadId: string) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('hubspot_thread_id', threadId)
    .eq('direction', 'inbound')
    .order('received_at', { ascending: true })

  throwIfError(error, 'No se pudo reagrupar mensajes')

  const inboundMessages = (data ?? []) as MessageRow[]
  if (!inboundMessages.length) return 0

  for (const message of inboundMessages) {
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        group_key: makeGroupKey(threadId, `${message.received_at}__${message.hubspot_message_id}`),
        grouped_text: message.raw_text,
        buffered_until: null,
        status: 'grouped',
      })
      .eq('id', message.id)

    throwIfError(updateError, 'No se pudo actualizar grupo de mensajes')
  }

  return inboundMessages.length
}

async function resolveThreadIdentity(
  thread: HubSpotThread,
  messages: HubSpotMessage[],
  contactCache: Map<string, Awaited<ReturnType<typeof getHubSpotContact>>>,
) {
  let contact = null

  if (thread.associatedContactId) {
    contact = contactCache.get(thread.associatedContactId) ?? null

    if (!contact) {
      contact = await getHubSpotContact(thread.associatedContactId).catch(() => null)
      if (contact) {
        contactCache.set(thread.associatedContactId, contact)
      }
    }
  }

  for (const message of messages) {
    const phone = getMessageCustomerPhone(message) ?? contact?.phone ?? null
    if (!phone) continue

    return {
      phone,
      displayName: getMessageDisplayName(message) ?? contact?.displayName ?? null,
      hubspotContactId: thread.associatedContactId ?? null,
    }
  }

  return {
    phone: contact?.phone ?? null,
    displayName: contact?.displayName ?? null,
    hubspotContactId: thread.associatedContactId ?? null,
  }
}

export async function syncHubSpotToSupabase(options: SyncOptions = {}) {
  const requestId = options.requestId ?? crypto.randomUUID()
  const threadLimit = options.threadLimit ?? 12
  const messageLimit = options.messageLimit ?? 25

  logger.info('hubspot.sync.start', {
    requestId,
    threadLimit,
    messageLimit,
  })

  const threads = await listHubSpotThreads(threadLimit)
  const contactCache = new Map<string, Awaited<ReturnType<typeof getHubSpotContact>>>()
  const customerCache = new Map<string, CustomerRow>()
  const rowsToUpsert: Array<Database['public']['Tables']['messages']['Insert']> = []
  const threadIds = new Set<string>()

  for (const thread of threads) {
    const messages = await listHubSpotMessages(thread.id, messageLimit)
    const identity = await resolveThreadIdentity(thread, messages, contactCache)

    let customer: CustomerRow | null = null
    if (identity.phone) {
      customer = customerCache.get(identity.phone) ?? null

      if (!customer) {
        customer = await ensureCustomerByPhone({
          phone: identity.phone,
          displayName: identity.displayName,
          hubspotContactId: identity.hubspotContactId,
        })

        if (customer) {
          customerCache.set(identity.phone, customer)
        }
      }
    }

    for (const message of messages) {
      const rawText = getMessageText(message)
      if (!rawText) continue

      const isInbound = mapDirection(message.direction) === 'inbound'
      const groupKey = isInbound ? makeGroupKey(thread.id, `${message.createdAt}__${message.id}`) : null

      rowsToUpsert.push({
        customer_id: customer?.id ?? null,
        hubspot_thread_id: thread.id,
        hubspot_message_id: message.id,
        direction: mapDirection(message.direction),
        raw_text: rawText,
        status: isInbound ? 'grouped' : 'ignored',
        received_at: message.createdAt,
        buffered_until: null,
        grouped_text: isInbound ? rawText : null,
        group_key: groupKey,
      })
      threadIds.add(thread.id)
    }
  }

  const messageIds = rowsToUpsert.map(item => String(item.hubspot_message_id))
  const knownIds = await collectKnownMessageIds(messageIds)
  const importedMessages = messageIds.filter(id => !knownIds.has(id)).length

  if (rowsToUpsert.length) {
    const supabase = getSupabaseAdmin()
    const { error } = await supabase
      .from('messages')
      .upsert(rowsToUpsert, { onConflict: 'hubspot_message_id' })

    throwIfError(error, 'No se pudo guardar mensajes importados')
  }

  let groupedTickets = 0
  for (const threadId of threadIds) {
    groupedTickets += await regroupThread(threadId)
  }

  logger.info('hubspot.sync.complete', {
    requestId,
    threadsProcessed: threads.length,
    importedMessages,
    groupedTickets,
  })

  return {
    ok: true,
    importedMessages,
    groupedTickets,
    threadsProcessed: threads.length,
  }
}

export async function listCustomers(search?: string) {
  const supabase = getSupabaseAdmin()
  let query = supabase
    .from('customers')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(200)

  if (search?.trim()) {
    const term = search.trim()
    query = query.or(`display_name.ilike.%${term}%,phone.ilike.%${term}%,razon_social.ilike.%${term}%`)
  }

  const { data, error } = await query

  throwIfError(error, 'No se pudo listar clientes')

  return data ?? []
}

export async function getCustomerById(id: string) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .single()

  throwIfError(error, 'No se pudo leer cliente')

  return data
}

export async function createCustomerRecord(input: {
  phone: string
  display_name: string
  razon_social?: string | null
  hubspot_contact_id?: string | null
  status?: CustomerRow['status']
}) {
  const phone = normalizePhone(input.phone)
  if (!phone) {
    throw new Error('Phone inválido')
  }

  return createCustomer({
    phone,
    displayName: input.display_name.trim(),
    razonSocial: input.razon_social ?? null,
    hubspotContactId: input.hubspot_contact_id ?? null,
    status: input.status ?? 'new',
  })
}

export async function updateCustomerRecord(
  id: string,
  input: {
    phone?: string
    display_name?: string
    razon_social?: string | null
    hubspot_contact_id?: string | null
    status?: CustomerRow['status']
  },
) {
  const patch: Database['public']['Tables']['customers']['Update'] = {}

  if (input.phone !== undefined) {
    const phone = normalizePhone(input.phone)
    if (!phone) throw new Error('Phone inválido')
    patch.phone = phone
  }

  if (input.display_name !== undefined) patch.display_name = input.display_name.trim()
  if (input.razon_social !== undefined) patch.razon_social = input.razon_social
  if (input.hubspot_contact_id !== undefined) patch.hubspot_contact_id = input.hubspot_contact_id
  if (input.status !== undefined) patch.status = input.status

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('customers')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()

  throwIfError(error, 'No se pudo editar cliente')

  return data
}

export async function listNormalizedThreads(limit = 10) {
  const threads = await listHubSpotThreads(limit)
  const contactCache = new Map<string, Awaited<ReturnType<typeof getHubSpotContact>>>()
  const items = []

  for (const thread of threads) {
    const messages = await listHubSpotMessages(thread.id, 1)
    const latestMessage = messages[0]
    const identity = await resolveThreadIdentity(thread, messages, contactCache)
    const customer = identity.phone ? await getCustomerByPhone(identity.phone) : null

    items.push({
      threadId: thread.id,
      phone: identity.phone,
      displayName: identity.displayName,
      lastMessageAt: thread.latestMessageTimestamp ?? thread.createdAt,
      latestDirection: latestMessage?.direction ?? null,
      previewText: latestMessage ? getMessageText(latestMessage) : null,
      customerId: customer?.id ?? null,
      associatedContactId: thread.associatedContactId ?? null,
      status: thread.status ?? 'UNKNOWN',
    })
  }

  return items
}

export async function getThreadMessages(threadId: string, limit = 30) {
  const messages = await listHubSpotMessages(threadId, limit)

  return {
    threadId,
    items: messages.map(message => ({
      messageId: message.id,
      createdAt: message.createdAt,
      direction: message.direction ?? null,
      text: getMessageText(message),
      sender: getMessageDisplayName(message) ?? message.createdBy ?? null,
      senderPhone: getMessageCustomerPhone(message),
      actorId: message.createdBy ?? null,
      senderType:
        message.direction === 'INCOMING'
          ? 'customer'
          : message.direction === 'OUTGOING'
            ? 'agent'
            : 'system',
    })),
  }
}

export async function listPendingMessageGroups() {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('messages')
    .select('*, customer:customers(*)')
    .eq('direction', 'inbound')
    .eq('status', 'grouped')
    .is('processed_at', null)
    .not('group_key', 'is', null)
    .order('received_at', { ascending: false })

  throwIfError(error, 'No se pudo listar grupos pendientes')

  const grouped = new Map<
    string,
    {
      groupKey: string
      threadId: string
      groupedText: string
      receivedAt: string
      lastMessageAt: string
      messageCount: number
      customer: CustomerRow | null
    }
  >()

  for (const item of (data ?? []) as MessageRowWithCustomer[]) {
    if (!item.group_key) continue

    const current = grouped.get(item.group_key)

    if (!current) {
      grouped.set(item.group_key, {
        groupKey: item.group_key,
        threadId: item.hubspot_thread_id,
        groupedText: item.grouped_text ?? item.raw_text,
        receivedAt: item.received_at,
        lastMessageAt: item.received_at,
        messageCount: 1,
        customer: item.customer ?? null,
      })
      continue
    }

    current.messageCount += 1
    if (new Date(item.received_at).getTime() > new Date(current.lastMessageAt).getTime()) {
      current.lastMessageAt = item.received_at
    }
  }

  return Array.from(grouped.values()).sort(
    (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
  )
}

export async function getPendingMessageGroup(groupKey: string) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('messages')
    .select('*, customer:customers(*)')
    .eq('group_key', groupKey)
    .order('received_at', { ascending: true })

  throwIfError(error, 'No se pudo leer detalle del grupo')

  const items = (data ?? []) as MessageRowWithCustomer[]
  if (!items.length) {
    return null
  }

  return {
    groupKey,
    threadId: items[0].hubspot_thread_id,
    customer: items[0].customer ?? null,
    groupedText: items[0].grouped_text ?? joinGroupedText(items.map(item => item.raw_text)),
    receivedAt: items[0].received_at,
    resolved: items.every(item => Boolean(item.resolved_at)),
    items: items.map(item => ({
      id: item.id,
      messageId: item.hubspot_message_id,
      text: item.raw_text,
      receivedAt: item.received_at,
      direction: item.direction,
      status: item.status,
    })),
  }
}

export async function resolveMessageGroup(groupKey: string) {
  return setMessageGroupResolution(groupKey, true)
}

export async function reopenMessageGroup(groupKey: string) {
  return setMessageGroupResolution(groupKey, false)
}

async function setMessageGroupResolution(groupKey: string, resolved: boolean) {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const patch = resolved
    ? {
        status: 'ignored' as const,
        processed_at: now,
        resolved_at: now,
      }
    : {
        status: 'grouped' as const,
        processed_at: null,
        resolved_at: null,
      }

  const { data, error } = await supabase
    .from('messages')
    .update(patch)
    .eq('group_key', groupKey)
    .select('id')

  throwIfError(error, 'No se pudo marcar el grupo como resuelto')

  return {
    ok: true,
    groupKey,
    updatedMessages: data?.length ?? 0,
  }
}

export async function resolveLatestOpenGroupForCustomer(customerId: string) {
  const supabase = getSupabaseAdmin()

  const { data: messages, error } = await supabase
    .from('messages')
    .select('group_key, received_at, resolved_at')
    .eq('customer_id', customerId)
    .is('resolved_at', null)
    .not('group_key', 'is', null)
    .order('received_at', { ascending: false })
    .limit(50)

  throwIfError(error, 'No se pudieron revisar tickets abiertos')

  const latestGroupKey = (messages ?? [])
    .map(item => item.group_key)
    .find((groupKey): groupKey is string => Boolean(groupKey))

  if (!latestGroupKey) {
    return { ok: true, updatedMessages: 0 }
  }

  return resolveMessageGroup(latestGroupKey)
}

export async function getCustomerTicketSummaries(customerId: string) {
  const supabase = getSupabaseAdmin()

  const [{ data: customer, error: customerError }, { data: messages, error: messagesError }, { data: orders, error: ordersError }] =
    await Promise.all([
      supabase.from('customers').select('*').eq('id', customerId).single(),
      supabase
        .from('messages')
        .select('*')
        .eq('customer_id', customerId)
        .order('received_at', { ascending: true }),
      supabase
        .from('orders')
        .select('*')
        .eq('customer_id', customerId)
        .eq('source', 'hubspot')
        .order('created_at', { ascending: false }),
    ])

  throwIfError(customerError, 'No se pudo leer cliente')
  throwIfError(messagesError, 'No se pudieron leer mensajes del cliente')
  throwIfError(ordersError, 'No se pudieron leer pedidos del cliente')

  return summarizeCustomerTickets(
    customer as CustomerRow,
    (messages ?? []) as MessageRow[],
    (orders ?? []) as Database['public']['Tables']['orders']['Row'][],
  )
}

export async function listCustomerInboxSummaries(limit = 80) {
  const supabase = getSupabaseAdmin()
  const { data: customers, error } = await supabase
    .from('customers')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(limit)

  throwIfError(error, 'No se pudo listar clientes operativos')

  const inbox: CustomerInboxSummary[] = []

  for (const customer of (customers ?? []) as CustomerRow[]) {
    const [{ data: messages, error: messagesError }, { data: orders, error: ordersError }] =
      await Promise.all([
        supabase
          .from('messages')
          .select('*')
          .eq('customer_id', customer.id)
          .order('received_at', { ascending: true }),
        supabase
          .from('orders')
          .select('*')
          .eq('customer_id', customer.id)
          .eq('source', 'hubspot')
          .order('created_at', { ascending: false }),
      ])

    throwIfError(messagesError, 'No se pudieron leer mensajes del cliente')
    throwIfError(ordersError, 'No se pudieron leer pedidos del cliente')

    const summary = summarizeCustomerTickets(
      customer,
      (messages ?? []) as MessageRow[],
      (orders ?? []) as Database['public']['Tables']['orders']['Row'][],
    )

    if (summary.ticketCount > 0) {
      inbox.push(summary)
    }
  }

  return inbox.sort((a, b) => {
    const aPriority = a.openTicketCount > 0 ? 0 : 1
    const bPriority = b.openTicketCount > 0 ? 0 : 1

    if (aPriority !== bPriority) return aPriority - bPriority

    const aTime = new Date(a.lastActivityAt ?? a.updated_at).getTime()
    const bTime = new Date(b.lastActivityAt ?? b.updated_at).getTime()
    return bTime - aTime
  })
}

export async function createOrderRecord(input: {
  customerId: string
  sourceGroupKey: string
  deliveryDate: string
  approvedBy: string
  notes?: string | null
  requestId?: string
}) {
  const requestId = input.requestId ?? crypto.randomUUID()
  const runtime = getRuntimeConfig()
  const group = await getPendingMessageGroup(input.sourceGroupKey)

  if (!group) {
    throw new Error('No existe el grupo de mensajes')
  }

  const supabase = getSupabaseAdmin()
  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      customer_id: input.customerId,
      customer_name: group.customer?.display_name ?? 'Cliente sin resolver',
      source_group_key: input.sourceGroupKey,
      source_thread_id: group.threadId,
      original_text: group.groupedText,
      original_message: group.groupedText,
      delivery_date: input.deliveryDate,
      status: 'aprobado',
      approved_by: input.approvedBy || runtime.primaryOperatorName,
      source: 'hubspot',
      portal_loaded: false,
      hub_ok: false,
      notes: input.notes ?? null,
      sheet_status: runtime.dryRun ? 'dry_run' : 'supabase_only',
    })
    .select('*')
    .single()

  throwIfError(error, 'No se pudo crear pedido')

  const now = new Date().toISOString()
  const { error: processedError } = await supabase
    .from('messages')
    .update({
      processed_at: now,
    })
    .eq('group_key', input.sourceGroupKey)

  throwIfError(processedError, 'No se pudo marcar el grupo como procesado')

  let hubspotCommentStatus: 'created' | 'failed' = 'created'

  try {
    await addHubSpotThreadComment(group.threadId, 'Ya agendado el pedido.')
    logger.info('order.hubspot.comment.created', {
      requestId,
      orderId: order.id,
      threadId: group.threadId,
    })
  } catch (error) {
    hubspotCommentStatus = 'failed'
    logger.warn('order.hubspot.comment.failed', {
      requestId,
      orderId: order.id,
      threadId: group.threadId,
      error,
    })
  }

  logger.info('order.supabase.success', {
    requestId,
    orderId: order.id,
    dryRun: runtime.dryRun,
  })

  return {
    ok: true,
    orderId: order.id,
    hubspotComment: {
      status: hubspotCommentStatus,
    },
    storage: {
      status: runtime.dryRun ? 'dry_run' : 'supabase_only',
    },
  }
}

export async function createManualAgendaOrder(input: {
  customerName: string
  approvedBy: string
  deliveryDate: string
  originalMessage: string
  notes?: string | null
}) {
  const runtime = getRuntimeConfig()
  const supabase = getSupabaseAdmin()

  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      customer_id: null,
      customer_name: input.customerName.trim(),
      source_group_key: null,
      source_thread_id: `manual_${crypto.randomUUID()}`,
      original_text: input.originalMessage,
      original_message: input.originalMessage,
      delivery_date: input.deliveryDate,
      status: 'pendiente_aprobacion',
      approved_by: input.approvedBy || runtime.primaryOperatorName,
      source: 'manual',
      portal_loaded: false,
      hub_ok: false,
      notes: input.notes ?? null,
      sheet_status: runtime.dryRun ? 'dry_run' : 'manual',
    })
    .select('*')
    .single()

  throwIfError(error, 'No se pudo crear pedido manual')

  return {
    ok: true,
    orderId: order.id,
    order,
  }
}

export async function listOrders() {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('orders')
    .select('*, customer:customers(*)')
    .order('created_at', { ascending: false })
    .limit(200)

  throwIfError(error, 'No se pudo listar pedidos')

  return (data ?? []) as OrderRowWithCustomer[]
}

export async function updateOrderStatus(id: string, status: string) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', id)
    .select('*')
    .single()

  throwIfError(error, 'No se pudo actualizar el estado del pedido')

  return data
}

export async function listAgendaOrders(deliveryDate?: string) {
  const supabase = getSupabaseAdmin()
  let query = supabase
    .from('orders')
    .select('*, customer:customers(*)')
    .eq('source', 'manual')
    .order('created_at', { ascending: false })
    .limit(200)

  if (deliveryDate) {
    query = query.eq('delivery_date', deliveryDate)
  }

  const { data, error } = await query
  throwIfError(error, 'No se pudo listar agenda')

  return (data ?? []) as OrderRowWithCustomer[]
}

export async function updateAgendaOrder(id: string, hubOk: boolean) {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('orders')
    .update({
      portal_loaded: hubOk,
      hub_ok: hubOk,
      status: hubOk ? 'aprobado' : 'pendiente_aprobacion',
    })
    .eq('id', id)
    .select('*, customer:customers(*)')
    .single()

  throwIfError(error, 'No se pudo actualizar la agenda')

  return data as OrderRowWithCustomer
}
