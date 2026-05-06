import type { CalendarSyncConfig } from './config'
import { logger } from './logger'

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

type ContactProperties = {
  firstname?: string | null
  lastname?: string | null
  email?: string | null
  entregar_el_dia?: string | null
  mensaje?: string | null
  enviar_a_calendario?: string | null
  ultimo_envio_calendario?: string | null
  error_sincronizacion?: string | null
}

type ContactSearchResult = {
  id: string
  properties?: ContactProperties
}

type SearchResponse = {
  results?: ContactSearchResult[]
  paging?: {
    next?: {
      after?: string
    }
  }
}

type AssociationListResponse = {
  results?: Array<{
    toObjectId?: string
    associationTypes?: Array<{
      category?: string
      typeId?: number
      label?: string | null
    }>
  }>
}

type CompanyResponse = {
  id: string
  properties?: {
    name?: string | null
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function parseBody(text: string) {
  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export function createHubSpotClient(config: CalendarSyncConfig) {
  async function request<T>(path: string, init?: RequestInit, attempt = 1): Promise<T> {
    const response = await fetch(`${HUBSPOT_BASE_URL}${path}`, {
      ...init,
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${config.hubspotAccessToken}`,
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
          path,
          status: response.status,
          attempt,
          delayMs,
        })
        await sleep(delayMs)
        return request<T>(path, init, attempt + 1)
      }

      throw new HubSpotApiError(`HubSpot request failed for ${path}`, response.status, payload)
    }

    return payload as T
  }

  function getContactDisplayName(properties: ContactProperties, contactId: string) {
    const parts = [properties.firstname, properties.lastname]
      .map(part => part?.trim())
      .filter(Boolean)

    if (parts.length > 0) return parts.join(' ')

    if (properties.email?.trim()) return properties.email.trim()

    return `Contacto ${contactId}`
  }

  function pickPrimaryCompanyId(results: NonNullable<AssociationListResponse['results']>) {
    const primary = results.find(item =>
      item.associationTypes?.some(type => type.typeId === 1 || type.label?.toLowerCase() === 'primary'),
    )

    return primary?.toObjectId ?? results[0]?.toObjectId ?? null
  }

  return {
    async searchPendingContacts() {
      const items: ContactSearchResult[] = []
      let after: string | undefined

      do {
        const payload = await request<SearchResponse>('/crm/v3/objects/contacts/search', {
          method: 'POST',
          body: JSON.stringify({
            limit: 100,
            after,
            filterGroups: [
              {
                filters: [
                  {
                    propertyName: 'enviar_a_calendario',
                    operator: 'EQ',
                    value: 'true',
                  },
                ],
              },
            ],
            properties: [
              'firstname',
              'lastname',
              'email',
              'entregar_el_dia',
              'mensaje',
              'enviar_a_calendario',
              'ultimo_envio_calendario',
              'error_sincronizacion',
            ],
          }),
        })

        items.push(...(payload.results ?? []))
        after = payload.paging?.next?.after
      } while (after)

      return items
    },

    async resolveCliente(contact: ContactSearchResult) {
      const properties = contact.properties ?? {}
      const contactName = getContactDisplayName(properties, contact.id)

      if (contactName) {
        return contactName
      }

      try {
        const associations = await request<AssociationListResponse>(
          `/crm/v4/objects/contacts/${contact.id}/associations/companies`,
        )

        const companyId = pickPrimaryCompanyId(associations.results ?? [])
        if (!companyId) {
          return getContactDisplayName(contact.properties ?? {}, contact.id)
        }

        const company = await request<CompanyResponse>(
          `/crm/v3/objects/companies/${companyId}?properties=name`,
        )

        const companyName = company.properties?.name?.trim()
        if (companyName) return companyName
      } catch (error) {
        logger.warn('hubspot.company_lookup_failed', {
          contactId: contact.id,
          error,
        })
      }

      return `Contacto ${contact.id}`
    },

    async updateContact(contactId: string, properties: Record<string, string>) {
      return request(`/crm/v3/objects/contacts/${contactId}`, {
        method: 'PATCH',
        body: JSON.stringify({ properties }),
      })
    },

    async getContact(contactId: string) {
      return request<{
        id: string
        properties?: ContactProperties
      }>(
        `/crm/v3/objects/contacts/${contactId}?properties=enviar_a_calendario,ultimo_envio_calendario,error_sincronizacion,mensaje,entregar_el_dia,firstname,lastname,email`,
      )
    },
  }
}

export type HubSpotContactSummary = ContactSearchResult
