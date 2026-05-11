import { loadSheetsConfig } from '@/lib/calendar-sync/config'
import { formatTimestamp } from '@/lib/calendar-sync/format'
import { createSheetsClient } from '@/lib/calendar-sync/sheets'

export const dynamic = 'force-dynamic'

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
  rowNumber?: number | string | null
}

function normalizeDate(value: unknown) {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  const date = new Date(trimmed)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeYesNo(value: unknown) {
  if (typeof value === 'boolean') return value ? 'si' : 'no'
  if (typeof value === 'number') return value !== 0 ? 'si' : 'no'
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    return ['si', 'sí', 'yes', 'true', '1', 'checked'].includes(normalized) ? 'si' : 'no'
  }
  return 'no'
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

function normalizeHubMark(value: unknown) {
  if (typeof value === 'boolean') return value ? 'OK' : ''
  if (typeof value === 'number') return value !== 0 ? 'OK' : ''
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    return ['ok', 'true', '1', 'si', 'sí', 'yes', 'checked'].includes(normalized) ? 'OK' : ''
  }
  return ''
}

function toDateRow(values: AgendaPayload, timestamp: string, fallback?: Partial<AgendaPayload>) {
  const pendingValue =
    values.producto_pendiente_de_entrega ?? values.pendiente_de_entrega ?? fallback?.producto_pendiente_de_entrega ?? fallback?.pendiente_de_entrega ?? 'no'
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const date = normalizeDate(searchParams.get('date'))
  const search = clean(searchParams.get('search'))

  const config = loadSheetsConfig()
  const sheets = createSheetsClient(config)
  const rows = await sheets.listCalendarRows()

  const items = rows
    .map(row => ({
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
    .filter(item => (date ? item.entregar_el_dia === date : true))
    .filter(item => (search ? item.cliente.toLowerCase().includes(search.toLowerCase()) : true))

  return Response.json({
    ok: true,
    items,
  })
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as AgendaPayload | null
  if (!body) {
    return Response.json({ ok: false, error: 'Body inválido' }, { status: 400 })
  }

  const config = loadSheetsConfig()
  const sheets = createSheetsClient(config)
  const result = await sheets.appendCalendarRow(
    toDateRow(body, formatTimestamp(new Date(), config.timezone)),
  )

  return Response.json({
    ok: true,
    updatedRange: result.updates?.updatedRange ?? null,
  })
}

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => null)) as AgendaPayload | null
  if (!body || !body.rowNumber) {
    return Response.json({ ok: false, error: 'Falta rowNumber para editar' }, { status: 400 })
  }

  const rowNumber = Number(body.rowNumber)
  if (!Number.isFinite(rowNumber) || rowNumber < 2) {
    return Response.json({ ok: false, error: 'rowNumber inválido' }, { status: 400 })
  }

  const config = loadSheetsConfig()
  const sheets = createSheetsClient(config)
  const timestamp = clean(body.timestamp) || formatTimestamp(new Date(), config.timezone)
  const existingRow = await sheets
    .listCalendarRows()
    .then(rows => rows.find(row => row.rowNumber === rowNumber))
    .catch(() => undefined)
  const result = await sheets.updateCalendarRow(
    rowNumber,
    toDateRow(
      {
        ...body,
        timestamp,
      },
      timestamp,
      existingRow,
    ),
  )

  return Response.json({
    ok: true,
    updatedRange: result.updatedRange ?? null,
  })
}
