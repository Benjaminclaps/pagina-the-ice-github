import { loadSheetsConfig } from '@/lib/calendar-sync/config'
import { formatTimestamp } from '@/lib/calendar-sync/format'
import { createSheetsClient } from '@/lib/calendar-sync/sheets'

export const dynamic = 'force-dynamic'

const DEFAULT_APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbwDaAubnzuYXgFEOHWm5bYqlCzBHCeZrLoMRhKlHbo4rcfiSvNrDqA0hx1qwZxngUObhA/exec'
const APPS_SCRIPT_TIMEOUT_MS = 8000

type AgendaPayload = {
  timestamp?: string
  cliente?: string
  encargado?: string
  mensaje?: string
  notas?: string
  entregar_el_dia?: string
  pendiente_de_entrega?: boolean | string
  producto_pendiente_de_entrega?: boolean | string
  cargado_en_hub?: boolean | string
  action?: string
  rowNumber?: number | string | null
}

type AgendaSourceResult = {
  ok: boolean
  source: 'apps_script' | 'sheets'
  items: Array<Record<string, unknown>>
  error?: string
  fallbackUsed?: boolean
  status?: number
}

function getAppsScriptUrl() {
  return process.env.AGENDA_APPS_SCRIPT_URL?.trim() || DEFAULT_APPS_SCRIPT_URL
}

function normalizeDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed

    const asDate = new Date(trimmed)
    if (!Number.isNaN(asDate.getTime())) {
      return asDate.toISOString().slice(0, 10)
    }
  }

  return ''
}

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeHubStatus(value: unknown) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    return ['ok', 'true', '1', 'si', 'sí', 'yes', 'checked'].includes(normalized)
  }
  return false
}

function normalizeDeliveryStatus(value: unknown) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    return ['si', 'sí', 'yes', 'true', '1', 'checked'].includes(normalized)
  }
  return false
}

function normalizeYesNo(value: unknown) {
  return normalizeDeliveryStatus(value) ? 'si' : 'no'
}

function normalizeHubMark(value: unknown) {
  return normalizeHubStatus(value) ? 'OK' : ''
}

function toDateRow(values: AgendaPayload, timestamp: string, fallback?: Partial<AgendaPayload>) {
  const pendingValue =
    values.producto_pendiente_de_entrega ??
    values.pendiente_de_entrega ??
    fallback?.producto_pendiente_de_entrega ??
    fallback?.pendiente_de_entrega ??
    'no'
  const hubValue = values.cargado_en_hub ?? fallback?.cargado_en_hub ?? false

  return [
    timestamp,
    clean(values.cliente) || 'Sin cliente',
    clean(values.encargado) || 'Sin asignar',
    clean(values.mensaje),
    clean(values.notas),
    normalizeDate(values.entregar_el_dia),
    normalizeYesNo(pendingValue),
    normalizeHubMark(hubValue),
  ]
}

function normalizeAgendaItem(item: Record<string, unknown>): Record<string, unknown> {
  return {
    ...item,
    entregar_el_dia: normalizeDate(item.entregar_el_dia),
    hub_ok: normalizeHubStatus(item.hub_ok ?? item.cargado_en_hub ?? item.estado),
    cargado_en_hub: normalizeHubStatus(item.cargado_en_hub ?? item.hub_ok ?? item.estado),
    pendiente_de_entrega: normalizeDeliveryStatus(
      item.pendiente_de_entrega ??
        item.producto_pendiente_de_entrega ??
        item.pendiente_entrega ??
        item.pendiente ??
        item.estado,
    ),
    producto_pendiente_de_entrega: normalizeDeliveryStatus(
      item.producto_pendiente_de_entrega ?? item.pendiente_de_entrega ?? item.pendiente ?? item.estado,
    ),
  }
}

async function fetchJsonWithTimeout(url: string, init: RequestInit, timeoutMs = APPS_SCRIPT_TIMEOUT_MS) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    })
    const payload = await response.json().catch(async () => ({
      ok: response.ok,
      text: await response.text().catch(() => ''),
    }))

    return {
      ok: response.ok,
      status: response.status,
      payload,
    }
  } catch (error) {
    return {
      ok: false,
      status: 0,
      payload: null,
      error: error instanceof Error ? error.message : 'No se pudo conectar con Apps Script',
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

function buildItemsFromRows(rows: Array<{ rowNumber: number; timestamp: string; cliente: string; encargado: string; mensaje: string; notas: string; entregar_el_dia: string; producto_pendiente_de_entrega: string; cargado_en_hub: string }>) {
  return rows.map(row => ({
    id: row.rowNumber,
    rowNumber: row.rowNumber,
    timestamp: row.timestamp,
    cliente: row.cliente,
    encargado: row.encargado,
    mensaje: row.mensaje,
    notas: row.notas,
    entregar_el_dia: row.entregar_el_dia,
    pendiente_de_entrega: normalizeYesNo(row.producto_pendiente_de_entrega) === 'si',
    producto_pendiente_de_entrega: normalizeYesNo(row.producto_pendiente_de_entrega) === 'si',
    cargado_en_hub: normalizeHubStatus(row.cargado_en_hub),
    estado: row.mensaje ? 'pendiente' : 'sin_mensaje',
    hub_ok: normalizeHubStatus(row.cargado_en_hub),
  }))
}

async function readLocalAgenda(date: string, search: string): Promise<AgendaSourceResult> {
  const config = loadSheetsConfig()
  const sheets = createSheetsClient(config)
  const rows = await sheets.listCalendarRows()
  const items = buildItemsFromRows(rows).filter(item => (date ? item.entregar_el_dia === date : true))
    .filter(item => (search ? String(item.cliente ?? '').toLowerCase().includes(search.toLowerCase()) : true))

  return {
    ok: true,
    source: 'sheets',
    items,
    fallbackUsed: true,
  }
}

async function readRemoteAgenda(date: string, search: string): Promise<AgendaSourceResult> {
  const response = await fetchJsonWithTimeout(getAppsScriptUrl(), { method: 'GET' })

  if (!response.ok) {
    return {
      ok: false,
      source: 'apps_script',
      items: [],
      error: response.error ?? `Apps Script respondió ${response.status}`,
      status: response.status,
    }
  }

  const payload = response.payload as { ok?: boolean; items?: unknown } | null
  if (!payload || payload.ok === false || !Array.isArray(payload.items)) {
    return {
      ok: false,
      source: 'apps_script',
      items: [],
      error: 'Respuesta inválida de Apps Script',
      status: response.status,
    }
  }

  const items = (payload.items as Array<Record<string, unknown>>)
    .map(normalizeAgendaItem)
    .filter(item => (date ? item.entregar_el_dia === date : true))
    .filter(item => (search ? String(item.cliente ?? '').toLowerCase().includes(search.toLowerCase()) : true))

  return {
    ok: true,
    source: 'apps_script',
    items,
    status: response.status,
  }
}

async function readAgendaItems(date: string, search: string) {
  const remote = await readRemoteAgenda(date, search)
  if (remote.ok) return remote

  const local = await readLocalAgenda(date, search)
  return {
    ...local,
    error: remote.error,
    fallbackUsed: true,
  }
}

async function createLocalAgenda(body: AgendaPayload) {
  const config = loadSheetsConfig()
  const sheets = createSheetsClient(config)
  const timestamp = clean(body.timestamp) || formatTimestamp(new Date(), config.timezone)

  if (body.action === 'update_hub_status') {
    const rowNumber = Number(body.rowNumber)

    if (!Number.isFinite(rowNumber) || rowNumber < 2) {
      throw new Error('Falta rowNumber válido para actualizar cargado_en_hub')
    }

    const existingRow = await sheets.listCalendarRows().then(rows => rows.find(row => row.rowNumber === rowNumber))

    if (!existingRow) {
      throw new Error('No se encontró la fila a actualizar en Sheets')
    }

    await sheets.updateCalendarRow(
      rowNumber,
      toDateRow(
        {
          ...existingRow,
          ...body,
          timestamp,
        },
        timestamp,
        existingRow,
      ),
    )

    return {
      ok: true,
      source: 'sheets' as const,
      fallbackUsed: true,
      message: 'Estado cargado_en_hub actualizado',
    }
  }

  const result = await sheets.appendCalendarRow(toDateRow(body, timestamp))

  return {
    ok: true,
    source: 'sheets' as const,
    fallbackUsed: true,
    updatedRange: result.updates?.updatedRange ?? null,
  }
}

async function updateLocalAgenda(body: AgendaPayload) {
  const config = loadSheetsConfig()
  const sheets = createSheetsClient(config)
  const timestamp = clean(body.timestamp) || formatTimestamp(new Date(), config.timezone)
  const rowNumber = Number(body.rowNumber)

  if (!Number.isFinite(rowNumber) || rowNumber < 2) {
    throw new Error('Falta rowNumber válido para actualizar el pedido')
  }

  const existingRow = await sheets.listCalendarRows().then(rows => rows.find(row => row.rowNumber === rowNumber))

  if (!existingRow) {
    throw new Error('No se encontró la fila a actualizar en Sheets')
  }

  const result = await sheets.updateCalendarRow(
    rowNumber,
    toDateRow(
      {
        ...existingRow,
        ...body,
        timestamp,
      },
      timestamp,
      existingRow,
    ),
  )

  return {
    ok: true,
    source: 'sheets' as const,
    fallbackUsed: true,
    updatedRange: result.updatedRange ?? null,
  }
}

async function deleteLocalAgenda(rowNumber: number) {
  const config = loadSheetsConfig()
  const sheets = createSheetsClient(config)

  await sheets.deleteCalendarRow(rowNumber)

  return {
    ok: true,
    source: 'sheets' as const,
    fallbackUsed: true,
    message: 'Pedido eliminado',
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const date = normalizeDate(searchParams.get('date'))
  const search = clean(searchParams.get('search'))

  const result = await readAgendaItems(date, search)

  if (!result.ok && result.items.length === 0) {
    return Response.json(
      {
        ok: false,
        error: result.error ?? 'No se pudo cargar la agenda',
        items: [],
        source: result.source,
        fallbackUsed: true,
      },
      { status: 502 },
    )
  }

  return Response.json({
    ok: true,
    items: result.items,
    source: result.source,
    fallbackUsed: result.fallbackUsed ?? false,
    error: result.ok ? undefined : result.error,
  })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)

  if (!body || typeof body !== 'object') {
    return Response.json({ ok: false, error: 'Body inválido' }, { status: 400 })
  }

  try {
    const local = await createLocalAgenda(body as AgendaPayload)
    return Response.json(local, { status: 200 })
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'No se pudo guardar el pedido',
      },
      { status: 502 },
    )
  }
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null)

  if (!body || typeof body !== 'object') {
    return Response.json({ ok: false, error: 'Body inválido' }, { status: 400 })
  }

  try {
    const local = await updateLocalAgenda(body as AgendaPayload)
    return Response.json(local, { status: 200 })
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'No se pudo actualizar el pedido',
      },
      { status: 502 },
    )
  }
}

export async function DELETE(request: Request) {
  const body = await request.json().catch(() => null)

  if (!body || typeof body !== 'object') {
    return Response.json({ ok: false, error: 'Body inválido' }, { status: 400 })
  }

  const rowNumber = Number((body as AgendaPayload).rowNumber ?? (body as { id?: number | string | null }).id)

  if (!Number.isFinite(rowNumber) || rowNumber < 2) {
    return Response.json({ ok: false, error: 'Falta rowNumber válido para eliminar el pedido' }, { status: 400 })
  }

  try {
    const local = await deleteLocalAgenda(rowNumber)
    return Response.json(local, { status: 200 })
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'No se pudo eliminar el pedido',
      },
      { status: 502 },
    )
  }
}
