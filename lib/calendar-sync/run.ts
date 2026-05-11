import { createHubSpotClient, type HubSpotContactSummary } from './hubspot'
import { createSheetsClient } from './sheets'
import { formatTimestamp, formatValidationError, isValidHubSpotDate } from './format'
import { logger } from './logger'
import type { CalendarSyncConfig } from './config'

type SyncResult = {
  scanned: number
  processed: number
  succeeded: number
  failed: number
}

function cleanText(value: string | null | undefined) {
  return value?.trim() ?? ''
}

function isFalseLike(value: string | null | undefined) {
  const normalized = cleanText(value).toLowerCase()
  return normalized === 'false' || normalized === 'no' || normalized === '0'
}

async function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function validateContact(contact: HubSpotContactSummary) {
  const properties = contact.properties ?? {}
  const deliverOn = cleanText(properties.entregar_el_dia)

  if (!isValidHubSpotDate(deliverOn)) {
    throw new Error(formatValidationError('La propiedad "entregar_el_dia" debe tener formato YYYY-MM-DD válido'))
  }

  return {
    message: cleanText(properties.mensaje),
    deliverOn,
  }
}

export async function runCalendarSync(config: CalendarSyncConfig): Promise<SyncResult> {
  const hubspot = createHubSpotClient(config)
  const sheets = createSheetsClient(config)
  const contacts = await hubspot.searchPendingContacts()

  logger.info('calendar.sync.start', {
    scanned: contacts.length,
  })

  let processed = 0
  let succeeded = 0
  let failed = 0

  for (const contact of contacts) {
    processed += 1

    try {
      const { message, deliverOn } = validateContact(contact)
      const cliente = await hubspot.resolveCliente(contact)
      const timestamp = formatTimestamp(new Date(), config.timezone)

      const sheetWrite = await sheets.writeCalendarRow([
        timestamp,
        cliente,
        '',
        message,
        '',
        deliverOn,
        'no',
        '',
      ])

      if (!sheetWrite.updatedRange) {
        throw new Error('Google Sheets no devolvió un rango actualizado')
      }

      await hubspot.updateContact(contact.id, {
        enviar_a_calendario: 'false',
        ultimo_envio_calendario: timestamp,
        error_sincronizacion: '',
      })

      let verified = false
      let lastSeen = ''
      for (let attempt = 1; attempt <= 4; attempt += 1) {
        const refreshed = await hubspot.getContact(contact.id)
        lastSeen = refreshed.properties?.enviar_a_calendario ?? ''

        if (isFalseLike(lastSeen)) {
          verified = true
          break
        }

        await wait(250 * attempt)
      }

      if (!verified) {
        throw new Error(
          `HubSpot no confirmó el cambio de enviar_a_calendario a false; valor actual: ${lastSeen || 'vacío'}`,
        )
      }

      succeeded += 1
      logger.info('calendar.sync.contact_synced', {
        contactId: contact.id,
        cliente,
        timestamp,
        sheetRange: sheetWrite.updatedRange,
      })
    } catch (error) {
      failed += 1
      const message =
        error instanceof Error
          ? error.message
          : 'No se pudo sincronizar el contacto'

      logger.error('calendar.sync.contact_failed', {
        contactId: contact.id,
        error,
      })

      try {
        await hubspot.updateContact(contact.id, {
          error_sincronizacion: message,
          enviar_a_calendario: 'true',
        })
      } catch (updateError) {
        logger.error('calendar.sync.error_update_failed', {
          contactId: contact.id,
          error: updateError,
        })
      }
    }
  }

  const result = {
    scanned: contacts.length,
    processed,
    succeeded,
    failed,
  }

  logger.info('calendar.sync.complete', result)
  return result
}
