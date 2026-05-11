'use client'

import { type DragEvent, type MouseEvent, useEffect, useMemo, useRef, useState } from 'react'

const ENCARGADOS = ['Bastian', 'Gus', 'Felipe', 'Benjamin'] as const
const AGENDA_SHEETS_API = '/api/agenda'

type Encargado = (typeof ENCARGADOS)[number]

type AgendaItem = {
  id?: string | number
  rowNumber?: string | number
  timestamp?: string
  cliente: string
  encargado: string
  mensaje: string
  notas: string
  entregar_el_dia?: string
  estado?: string
  hub_ok?: boolean | string
  cargado_en_hub?: boolean | string
  pendiente_de_entrega?: boolean | string
  producto_pendiente_de_entrega?: boolean | string
}

type Draft = {
  cliente: string
  encargado: Encargado | ''
  mensaje: string
  notas: string
  entregar_el_dia: string
  pendienteEntrega: boolean
}

type OrderModalState =
  | {
      mode: 'create'
      date: string
      item: null
    }
  | {
      mode: 'edit'
      date: string
      item: AgendaItem
    }

type CalendarView = 'day' | 'scroll3' | 'twoWeeks'

type HubFilter = 'all' | 'ok' | 'pending'
type DeliveryFilter = 'all' | 'yes' | 'no'

const AGENDA_WORKSPACE_CACHE_KEY = 'pagina-the-ice.agenda-workspace.v1'

const inputBase =
  'w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-[15px] text-white outline-none transition placeholder:text-white/25 focus:border-cyan-400 focus:bg-white/[0.09]'

function openDatePicker(event: MouseEvent<HTMLInputElement>) {
  const input = event.currentTarget as HTMLInputElement & { showPicker?: () => void }
  if (typeof input.showPicker === 'function') {
    input.showPicker()
  }
}

function todayValue() {
  const date = new Date()
  const tzOffset = date.getTimezoneOffset() * 60000
  const local = new Date(date.getTime() - tzOffset)
  return local.toISOString().slice(0, 10)
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00`)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function prettyDate(value: string) {
  if (!value) return 'Sin fecha'
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

function formatDayLabel(value: string) {
  return new Intl.DateTimeFormat('es-CL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${value}T12:00:00`))
}

function formatVisibleRange(start: string, end: string) {
  if (start === end) {
    return `Mostrando ${formatDayLabel(start)}`
  }

  return `Mostrando ${formatDayLabel(start)} - ${formatDayLabel(end)}`
}

function formatShortText(value: string, size = 80) {
  const text = value.trim()
  if (text.length <= size) return text
  return `${text.slice(0, size)}...`
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function isToday(value: string) {
  return value === todayValue()
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

function yesNoLabel(value: boolean) {
  return value ? 'Sí' : 'No'
}

function readAgendaKey(item: AgendaItem) {
  const record = item as Record<string, unknown>
  const candidates = [
    record.id,
    record.rowNumber,
    record.row_id,
    record.rowId,
    record.sheet_row,
    record.sheetRow,
    record.timestamp,
    record.created_at,
    record.createdAt,
  ]

  for (const candidate of candidates) {
    if (typeof candidate === 'string' || typeof candidate === 'number') {
      return String(candidate)
    }
  }

  return [
    item.cliente?.trim() ?? '',
    item.encargado?.trim() ?? '',
    item.mensaje?.trim() ?? '',
    item.notas?.trim() ?? '',
    item.entregar_el_dia?.trim() ?? '',
  ].join('|')
}

type WorkspaceCache = {
  selectedDate?: string
  viewMode?: CalendarView
  search?: string
  hubFilter?: HubFilter
  deliveryFilter?: DeliveryFilter
  statusByKey?: Record<string, boolean>
}

function readWorkspaceCache(): WorkspaceCache {
  if (typeof window === 'undefined') return {}

  try {
    const raw = window.localStorage.getItem(AGENDA_WORKSPACE_CACHE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as WorkspaceCache
    return {
      selectedDate: typeof parsed.selectedDate === 'string' ? parsed.selectedDate : undefined,
      viewMode:
        parsed.viewMode === 'day' || parsed.viewMode === 'scroll3' || parsed.viewMode === 'twoWeeks'
          ? parsed.viewMode
          : undefined,
      search: typeof parsed.search === 'string' ? parsed.search : undefined,
      hubFilter:
        parsed.hubFilter === 'all' || parsed.hubFilter === 'ok' || parsed.hubFilter === 'pending'
          ? parsed.hubFilter
          : undefined,
      deliveryFilter:
        parsed.deliveryFilter === 'all' || parsed.deliveryFilter === 'yes' || parsed.deliveryFilter === 'no'
          ? parsed.deliveryFilter
          : undefined,
      statusByKey:
        parsed.statusByKey && typeof parsed.statusByKey === 'object' ? parsed.statusByKey : {},
    }
  } catch {
    return {}
  }
}

function dedupeAgendaItems(items: AgendaItem[]) {
  const byKey = new Map<string, AgendaItem>()

  for (const item of items) {
    byKey.set(readAgendaKey(item), item)
  }

  return [...byKey.values()]
}

type AgendaSourceResult = {
  ok: boolean
  source: 'agenda-sheet' | 'agenda'
  items: AgendaItem[]
  error?: string
}

async function readAgendaSource(
  url: string,
  signal?: AbortSignal,
): Promise<AgendaSourceResult> {
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      signal,
    })

    const payload = await response.json().catch(() => null)

    if (!response.ok) {
      return {
        ok: false,
        source: url.includes('agenda-sheet') ? 'agenda-sheet' : 'agenda',
        items: [],
        error: payload?.error ?? `No se pudo cargar ${url}`,
      }
    }

    const items = Array.isArray(payload?.items) ? (payload.items as AgendaItem[]) : []

    return {
      ok: true,
      source: url.includes('agenda-sheet') ? 'agenda-sheet' : 'agenda',
      items,
    }
  } catch (error) {
    return {
      ok: false,
      source: url.includes('agenda-sheet') ? 'agenda-sheet' : 'agenda',
      items: [],
      error: error instanceof Error ? error.message : `No se pudo cargar ${url}`,
    }
  }
}

async function loadAgendaItems(signal?: AbortSignal) {
  const primary = await readAgendaSource('/api/agenda', signal)

  if (primary.ok) {
    return {
      ...primary,
      items: dedupeAgendaItems(primary.items),
    }
  }

  const fallback = await readAgendaSource('/api/agenda-sheet', signal)

  if (fallback.ok) {
    return {
      ...fallback,
      items: dedupeAgendaItems(fallback.items),
      error: primary.error,
      fallbackUsed: true,
    }
  }

  return {
    ok: false as const,
    source: primary.source,
    items: [],
    error: primary.error ?? fallback.error,
    fallbackUsed: true,
  }
}

function blankDraft(date: string): Draft {
  return {
    cliente: '',
    encargado: '',
    mensaje: '',
    notas: '',
    entregar_el_dia: date,
    pendienteEntrega: false,
  }
}

function draftFromModalState(state: OrderModalState | null): Draft {
  const baseDate = state?.date ?? todayValue()

  if (!state?.item) {
    return blankDraft(baseDate)
  }

  return {
    cliente: state.item.cliente ?? '',
    encargado: (state.item.encargado as Encargado | '') ?? '',
    mensaje: state.item.mensaje ?? '',
    notas: state.item.notas ?? '',
    entregar_el_dia: state.item.entregar_el_dia?.trim() || baseDate,
    pendienteEntrega: normalizeDeliveryStatus(
      state.item.pendiente_de_entrega ?? state.item.producto_pendiente_de_entrega,
    ),
  }
}

function OrderCard({
  item,
  onClick,
  onToggleHub,
  showHubToggle = false,
  draggable = false,
  dragging = false,
  onDragStart,
  onDragEnd,
}: {
  item: AgendaItem
  onClick: () => void
  onToggleHub?: (nextValue: boolean) => void
  showHubToggle?: boolean
  draggable?: boolean
  dragging?: boolean
  onDragStart?: (event: DragEvent<HTMLElement>) => void
  onDragEnd?: (event: DragEvent<HTMLElement>) => void
}) {
  return (
    <article
      role="button"
      tabIndex={0}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={() => onClick()}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onClick()
        }
      }}
      className={`block w-full rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-3 text-left shadow-[0_12px_30px_rgba(0,0,0,0.16)] transition hover:-translate-y-0.5 hover:border-cyan-300/25 hover:bg-white/[0.07] ${
        draggable ? 'cursor-grab active:cursor-grabbing' : ''
      } ${dragging ? 'opacity-50 ring-1 ring-cyan-300/40' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-5 text-white">{item.cliente?.trim() || 'Sin cliente'}</p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-cyan-100/60">
            {item.encargado?.trim() || 'Sin encargado'}
          </p>
        </div>
        <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-white/45">
          Pedido
        </span>
      </div>

      {item.mensaje?.trim() ? (
        <p className="mt-2 text-xs leading-5 text-white/62">{formatShortText(item.mensaje, 95)}</p>
      ) : null}

      {item.notas?.trim() ? (
        <p className="mt-2 text-[11px] leading-5 text-white/38">Notas: {formatShortText(item.notas, 70)}</p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${
          normalizeDeliveryStatus(item.pendiente_de_entrega ?? item.producto_pendiente_de_entrega)
            ? 'border-amber-200/25 bg-amber-200/10 text-amber-50'
            : 'border-white/10 bg-white/[0.04] text-white/55'
        }`}>
          PDE: {yesNoLabel(normalizeDeliveryStatus(item.pendiente_de_entrega ?? item.producto_pendiente_de_entrega))}
        </span>

        {showHubToggle && onToggleHub ? (
          <label
            className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] ${
              item.hub_ok
                ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-50'
                : 'border-white/10 bg-white/[0.04] text-white/55'
            }`}
            onClick={event => event.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={Boolean(item.hub_ok ?? item.cargado_en_hub)}
              onChange={event => {
                event.stopPropagation()
                onToggleHub(event.target.checked)
              }}
              onClick={event => event.stopPropagation()}
              className="h-3.5 w-3.5 rounded border-white/20 bg-white/10 text-emerald-400 focus:ring-emerald-400"
            />
            <span>Hub cargado</span>
          </label>
        ) : null}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[0.18em] text-cyan-200/55">Editar</span>
        <span className="text-[11px] text-white/35">Click para abrir</span>
      </div>
    </article>
  )
}

function DayDetailModal({
  open,
  date,
  items,
  onClose,
  onCreate,
  onEdit,
}: {
  open: boolean
  date: string | null
  items: AgendaItem[]
  onClose: () => void
  onCreate: (date: string) => void
  onEdit: (item: AgendaItem) => void
}) {
  if (!open || !date) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-4 py-4 backdrop-blur-sm md:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-[32px] border border-white/12 bg-[linear-gradient(180deg,rgba(12,21,38,0.98),rgba(6,10,18,0.98))] p-5 shadow-[0_30px_120px_rgba(0,0,0,0.55)] md:p-6"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-cyan-200/70">Pedidos del día</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-white">{prettyDate(date)}</h3>
            <p className="mt-2 text-sm text-white/48">
              {items.length} pedido{items.length === 1 ? '' : 's'} en esta fecha
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/12 bg-white/[0.05] px-3 py-2 text-sm text-white/72 transition hover:bg-white/[0.09]"
          >
            Cerrar
          </button>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => onCreate(date)}
            className="rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 text-sm font-bold uppercase tracking-[0.18em] text-white shadow-lg shadow-cyan-950/30 transition hover:from-cyan-400 hover:to-blue-500"
          >
            + Agregar pedido
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-white/12 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white/78 transition hover:bg-white/[0.08]"
          >
            Seguir viendo calendario
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {items.length > 0 ? (
            items.map((item, index) => (
              <OrderCard
                key={`${date}-${index}-${item.id ?? item.rowNumber ?? item.cliente}`}
                item={item}
                onClick={() => onEdit(item)}
              />
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-6 text-sm text-white/48">
              No hay pedidos cargados para esta fecha.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function OrderComposerModal({
  open,
  state,
  onClose,
  onSaved,
}: {
  open: boolean
  state: OrderModalState | null
  onClose: () => void
  onSaved: () => void
}) {
  const [draft, setDraft] = useState<Draft>(() => draftFromModalState(state))
  const [status, setStatus] = useState<'idle' | 'saving' | 'deleting' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const itemRowNumber = state?.item?.rowNumber ?? state?.item?.id ?? null

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft(prev => ({ ...prev, [key]: value }))

  const handleSubmit = async () => {
    setStatus('saving')
    setError(null)

    try {
      const requestBody = {
        cliente: draft.cliente.trim() || 'Sin cliente',
        encargado: draft.encargado || 'Sin asignar',
        mensaje: draft.mensaje.trim(),
        notas: draft.notas.trim(),
        entregar_el_dia: draft.entregar_el_dia,
        pendiente_de_entrega: draft.pendienteEntrega,
        producto_pendiente_de_entrega: draft.pendienteEntrega,
        rowNumber: state?.item?.rowNumber ?? state?.item?.id ?? null,
        timestamp: state?.item?.timestamp ?? null,
      }

      const response = await fetch(AGENDA_SHEETS_API, {
        method: state?.mode === 'edit' ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      const responsePayload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(responsePayload?.error ?? 'No se pudo guardar el pedido')
      }

      setStatus('success')
      onSaved()
      onClose()
    } catch (saveError) {
      setStatus('error')
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar el pedido')
    }
  }

  const handleDelete = async () => {
    if (state?.mode !== 'edit') return
    if (!itemRowNumber) {
      setError('No se encontró la fila del pedido para eliminarlo')
      return
    }

    const confirmed = window.confirm('¿Eliminar este pedido? Esta acción no se puede deshacer.')
    if (!confirmed) return

    setStatus('deleting')
    setError(null)

    try {
      const response = await fetch(AGENDA_SHEETS_API, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rowNumber: itemRowNumber,
        }),
      })

      const responsePayload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(responsePayload?.error ?? 'No se pudo eliminar el pedido')
      }

      setStatus('success')
      onSaved()
      onClose()
    } catch (deleteError) {
      setStatus('error')
      setError(deleteError instanceof Error ? deleteError.message : 'No se pudo eliminar el pedido')
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-4 py-4 backdrop-blur-sm md:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-[32px] border border-white/12 bg-[linear-gradient(180deg,rgba(12,21,38,0.98),rgba(6,10,18,0.98))] p-5 shadow-[0_30px_120px_rgba(0,0,0,0.55)] md:p-6"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-cyan-200/70">
              {state?.mode === 'edit' ? 'Editar pedido' : 'Nuevo pedido'}
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-white">
              {prettyDate(draft.entregar_el_dia)}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/12 bg-white/[0.05] px-3 py-2 text-sm text-white/72 transition hover:bg-white/[0.09]"
          >
            Cerrar
          </button>
        </div>

        <div className="mt-5 grid gap-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-[11px] uppercase tracking-[0.28em] text-cyan-200/70">Previsualización</p>
            <p className="mt-2 text-sm font-semibold text-white">{draft.cliente.trim() || 'Sin cliente'}</p>
            <p className="mt-1 text-xs text-white/45">{draft.encargado || 'Sin encargado'}</p>
            <div className="mt-3 rounded-2xl border border-white/10 bg-black/25 p-3">
              <p className="text-[10px] uppercase tracking-[0.22em] text-white/35">Mensaje actual</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/82">
                {draft.mensaje.trim() || 'Sin mensaje todavía.'}
              </p>
            </div>
          </div>

          <label className="grid gap-2">
            <span className="text-[11px] uppercase tracking-[0.28em] text-cyan-300 font-semibold">
              Cliente
            </span>
            <input
              type="text"
              value={draft.cliente}
              onChange={e => update('cliente', e.target.value)}
              placeholder="Ej: Santa Brasa"
              className={inputBase}
            />
          </label>

          <label className="grid gap-2">
            <span className="text-[11px] uppercase tracking-[0.28em] text-cyan-300 font-semibold">
              Entregar el día
            </span>
            <input
              type="date"
              value={draft.entregar_el_dia}
              onChange={e => update('entregar_el_dia', e.target.value)}
              onClick={openDatePicker}
              className={`${inputBase} cursor-pointer`}
            />
          </label>

          <label className="grid gap-2">
            <span className="text-[11px] uppercase tracking-[0.28em] text-cyan-300 font-semibold">
              Encargado
            </span>
            <select
              value={draft.encargado}
              onChange={e => update('encargado', e.target.value as Encargado | '')}
              className={inputBase}
            >
              <option value="">Selecciona...</option>
              {ENCARGADOS.map(encargado => (
                <option key={encargado} value={encargado} className="bg-slate-900">
                  {encargado}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-[11px] uppercase tracking-[0.28em] text-cyan-300 font-semibold">
              Mensaje
            </span>
            <textarea
              value={draft.mensaje}
              onChange={e => update('mensaje', e.target.value)}
              placeholder="Detalle del pedido..."
              rows={5}
              className={`${inputBase} resize-none`}
            />
          </label>

          <label className="grid gap-2">
            <span className="text-[11px] uppercase tracking-[0.28em] text-cyan-300 font-semibold">
              Notas
            </span>
            <input
              type="text"
              value={draft.notas}
              onChange={e => update('notas', e.target.value)}
              placeholder="Notas internas"
              className={inputBase}
            />
          </label>

          <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
            <input
              type="checkbox"
              checked={draft.pendienteEntrega}
              onChange={e => update('pendienteEntrega', e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-white/20 bg-white/10 text-amber-400 focus:ring-amber-400"
            />
            <span className="block">
              <span className="block text-[11px] uppercase tracking-[0.28em] text-amber-200 font-semibold">
                Pendiente de entrega
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-white/45">
                Si lo marcas, se guardara como si. Si no, queda como no.
              </span>
            </span>
          </label>
        </div>

        <div className="mt-6 flex flex-col gap-3 md:flex-row md:justify-end">
          {state?.mode === 'edit' ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={status === 'saving' || status === 'deleting'}
              className="rounded-2xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm font-bold uppercase tracking-[0.18em] text-rose-100 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === 'deleting' ? 'Eliminando...' : 'Eliminar pedido'}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            disabled={status === 'saving' || status === 'deleting'}
            className="rounded-2xl border border-white/12 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white/78 transition hover:bg-white/[0.08]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={status === 'saving' || status === 'deleting'}
            className="rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 text-sm font-bold uppercase tracking-[0.18em] text-white shadow-lg shadow-cyan-950/30 transition hover:from-cyan-400 hover:to-blue-500"
          >
            {status === 'saving'
              ? 'Guardando...'
              : state?.mode === 'edit'
                ? 'Guardar cambios'
                : 'Agregar pedido'}
          </button>
        </div>

        {error ? <p className="mt-4 text-sm text-rose-200">{error}</p> : null}
      </div>
    </div>
  )
}

export default function TwoWeekCalendar() {
  const [items, setItems] = useState<AgendaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<CalendarView>('day')
  const [selectedDate, setSelectedDate] = useState(todayValue())
  const [hubFilter, setHubFilter] = useState<HubFilter>('all')
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryFilter>('all')
  const [hubStatusByKey, setHubStatusByKey] = useState<Record<string, boolean>>({})
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [modalState, setModalState] = useState<OrderModalState | null>(null)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [visibleRange, setVisibleRange] = useState<{ start: string; end: string } | null>(null)
  const [draggingKey, setDraggingKey] = useState<string | null>(null)
  const [dragOverDate, setDragOverDate] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const dayRefs = useRef<Array<HTMLElement | null>>([])

  const days = useMemo(() => {
    const base = selectedDate || todayValue()
    return Array.from({ length: 14 }, (_, index) => addDays(base, index))
  }, [selectedDate])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const cache = readWorkspaceCache()

      if (cache.selectedDate) {
        setSelectedDate(cache.selectedDate)
      }

      if (cache.viewMode) {
        setViewMode(cache.viewMode)
      } else {
        setViewMode('day')
      }

      if (typeof cache.search === 'string') {
        setSearch(cache.search)
      }

      if (cache.hubFilter) {
        setHubFilter(cache.hubFilter)
      }

      if (cache.deliveryFilter) {
        setDeliveryFilter(cache.deliveryFilter)
      }

      if (cache.statusByKey) {
        setHubStatusByKey(cache.statusByKey)
      }

      setHydrated(true)
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try {
      const nextCache: WorkspaceCache = {
        selectedDate,
        viewMode,
        search,
        hubFilter,
        deliveryFilter,
        statusByKey: hubStatusByKey,
      }

      window.localStorage.setItem(AGENDA_WORKSPACE_CACHE_KEY, JSON.stringify(nextCache))
    } catch {
      // Ignore storage failures.
    }
  }, [hydrated, selectedDate, viewMode, search, hubFilter, deliveryFilter, hubStatusByKey])

  useEffect(() => {
    if (!hydrated) return
    const controller = new AbortController()

    const load = async () => {
      setLoading(true)
      setError(null)

      const result = await loadAgendaItems(controller.signal)

      if (controller.signal.aborted) return

      if (!result.ok) {
        setItems([])
        setError(result.error ?? 'No se pudo cargar la agenda')
        setLoading(false)
        return
      }

      setItems(result.items)
      setError(null)
      setLoading(false)
    }

    load()

    return () => controller.abort()
  }, [hydrated])

  const normalizedSearch = normalize(search)

  const viewItems = useMemo(() => {
    return items.map(item => {
      const agendaKey = readAgendaKey(item)
      const hasCachedValue = Object.prototype.hasOwnProperty.call(hubStatusByKey, agendaKey)
      const hubOk = hasCachedValue
        ? hubStatusByKey[agendaKey]
        : normalizeHubStatus(item.hub_ok ?? item.cargado_en_hub ?? item.estado)

      return {
        ...item,
        agendaKey,
        hubOk,
      }
    })
  }, [items, hubStatusByKey])

  const searchItems = useMemo(() => {
    return viewItems.filter(item => {
      if (!normalizedSearch) return true
      return normalize(item.cliente ?? '').includes(normalizedSearch)
    })
  }, [normalizedSearch, viewItems])

  const filteredItems = useMemo(() => {
    return searchItems.filter(item => {
      if (hubFilter === 'ok') return item.hubOk
      if (hubFilter === 'pending') return !item.hubOk
      return true
    })
  }, [hubFilter, searchItems])

  const deliveryFilteredItems = useMemo(() => {
    return filteredItems.filter(item => {
      const deliveryOk = normalizeDeliveryStatus(item.pendiente_de_entrega ?? item.producto_pendiente_de_entrega)
      if (deliveryFilter === 'yes') return deliveryOk
      if (deliveryFilter === 'no') return !deliveryOk
      return true
    })
  }, [deliveryFilter, filteredItems])

  const itemsByDate = useMemo(() => {
    const map = new Map<string, AgendaItem[]>()

    for (const item of deliveryFilteredItems) {
      const date = item.entregar_el_dia?.trim()
      if (!date) continue

      const current = map.get(date)
      if (current) {
        current.push(item)
        continue
      }

      map.set(date, [item])
    }

    for (const list of map.values()) {
      list.sort((a, b) => {
        const aName = normalize(a.cliente ?? '')
        const bName = normalize(b.cliente ?? '')
        return aName.localeCompare(bName, 'es')
      })
    }

    return map
  }, [deliveryFilteredItems])

  const currentDayItems = useMemo(
    () => deliveryFilteredItems.filter(item => item.entregar_el_dia?.trim() === selectedDate),
    [deliveryFilteredItems, selectedDate],
  )

  const dayScopedSearchItems = useMemo(
    () => searchItems.filter(item => item.entregar_el_dia?.trim() === selectedDate),
    [searchItems, selectedDate],
  )

  const countBaseItems = viewMode === 'day' ? dayScopedSearchItems : searchItems
  const okCount = countBaseItems.filter(item => item.hubOk).length
  const pendingCount = countBaseItems.length - okCount
  const deliveryYesCount = countBaseItems.filter(item =>
    normalizeDeliveryStatus(item.pendiente_de_entrega ?? item.producto_pendiente_de_entrega),
  ).length
  const deliveryNoCount = countBaseItems.length - deliveryYesCount
  const selectedDateItems = currentDayItems
  const selectedDayItems = selectedDay ? itemsByDate.get(selectedDay) ?? [] : []
  const weeks = [days.slice(0, 7), days.slice(7, 14)]

  const openComposer = (date: string) => setModalState({ mode: 'create', date, item: null })
  const openEditor = (item: AgendaItem) =>
    setModalState({
      mode: 'edit',
      date: item.entregar_el_dia?.trim() || todayValue(),
      item,
    })
  const openDayDetail = (date: string) => setSelectedDay(date)
  const closeDayDetail = () => setSelectedDay(null)
  const closeComposer = () => setModalState(null)
  const updateHubStatus = async (item: AgendaItem, nextValue: boolean) => {
    const key = readAgendaKey(item)
    setSaveError(null)

    setHubStatusByKey(prev => ({ ...prev, [key]: nextValue }))
    setItems(prev =>
      prev.map(current =>
        readAgendaKey(current) === key
          ? {
              ...current,
              hub_ok: nextValue,
              cargado_en_hub: nextValue,
              estado: nextValue ? 'ok' : 'pendiente',
            }
          : current,
      ),
    )

    try {
      const response = await fetch('/api/agenda', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'update_hub_status',
          ...item,
          cargado_en_hub: nextValue,
          estado: nextValue ? 'ok' : 'pendiente',
          rowNumber: item.rowNumber ?? null,
          agenda_key: key,
        }),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(data?.error ?? 'No se pudo guardar el estado en Sheets')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo guardar el estado en Sheets'
      setSaveError(message)
    }
  }

  const moveOrderToDate = async (item: AgendaItem, nextDate: string) => {
    const currentDate = item.entregar_el_dia?.trim() ?? ''
    if (!nextDate || nextDate === currentDate) return

    const key = readAgendaKey(item)
    setSaveError(null)

    const previousItems = items

    setItems(prev =>
      prev.map(current =>
        readAgendaKey(current) === key
          ? {
              ...current,
              entregar_el_dia: nextDate,
            }
          : current,
      ),
    )

    try {
      const response = await fetch('/api/agenda', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...item,
          entregar_el_dia: nextDate,
          rowNumber: item.rowNumber ?? null,
          agenda_key: key,
        }),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.error ?? 'No se pudo mover el pedido')
      }

      setSelectedDate(prev => (viewMode === 'day' && prev === currentDate ? nextDate : prev))
    } catch (error) {
      setItems(previousItems)
      const message = error instanceof Error ? error.message : 'No se pudo mover el pedido'
      setSaveError(message)
    } finally {
      setDraggingKey(null)
      setDragOverDate(null)
    }
  }

  const handleCardDragStart = (event: DragEvent<HTMLElement>, item: AgendaItem) => {
    const key = readAgendaKey(item)
    setDraggingKey(key)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', key)
  }

  const handleCardDragEnd = () => {
    setDraggingKey(null)
    setDragOverDate(null)
  }

  const handleDayDragOver = (event: DragEvent<HTMLElement>, date: string) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    if (dragOverDate !== date) {
      setDragOverDate(date)
    }
  }

  const handleDayDragLeave = (date: string) => {
    if (dragOverDate === date) {
      setDragOverDate(null)
    }
  }

  const handleDayDrop = async (event: DragEvent<HTMLElement>, date: string) => {
    event.preventDefault()
    const key = event.dataTransfer.getData('text/plain')
    if (!key) {
      setDragOverDate(null)
      return
    }

    const item = items.find(current => readAgendaKey(current) === key)
    if (!item) {
      setDragOverDate(null)
      return
    }

    await moveOrderToDate(item, date)
  }

  const refreshItems = async () => {
    const result = await loadAgendaItems()

    if (!result.ok) {
      setSaveError(result.error ?? 'No se pudo actualizar la agenda')
      return
    }

    setItems(result.items)
    setHubStatusByKey(prev => {
      const next = { ...prev }
      let changed = false

      result.items.forEach((item: AgendaItem) => {
        const key = readAgendaKey(item)
        if (!(key in next)) {
          next[key] = normalizeHubStatus(item.hub_ok ?? item.cargado_en_hub ?? item.estado)
          changed = true
        }
      })

      return changed ? next : prev
    })
  }

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container || viewMode !== 'scroll3') return

    let rafId = 0

    const measureVisibleRange = () => {
      const root = scrollContainerRef.current
      if (!root) return

      const rootRect = root.getBoundingClientRect()
      const visibleDays = dayRefs.current
        .map((node, index) => {
          if (!node) return null

          const rect = node.getBoundingClientRect()
          const isVisible = rect.right > rootRect.left + 24 && rect.left < rootRect.right - 24
          return isVisible ? days[index] : null
        })
        .filter((value): value is string => value !== null)

      if (visibleDays.length === 0) return

      const nextRange = {
        start: visibleDays[0],
        end: visibleDays[visibleDays.length - 1],
      }

      setVisibleRange(prev =>
        prev?.start === nextRange.start && prev?.end === nextRange.end ? prev : nextRange,
      )
    }

    const scheduleMeasure = () => {
      window.cancelAnimationFrame(rafId)
      rafId = window.requestAnimationFrame(measureVisibleRange)
    }

    const resizeObserver = new ResizeObserver(scheduleMeasure)
    resizeObserver.observe(container)

    scheduleMeasure()
    container.addEventListener('scroll', scheduleMeasure, { passive: true })
    window.addEventListener('resize', scheduleMeasure)

    return () => {
      window.cancelAnimationFrame(rafId)
      container.removeEventListener('scroll', scheduleMeasure)
      window.removeEventListener('resize', scheduleMeasure)
      resizeObserver.disconnect()
    }
  }, [days, viewMode])

  return (
    <section
      className={`space-y-6 ${
        viewMode === 'twoWeeks' ? 'lg:relative lg:left-1/2 lg:w-screen lg:-translate-x-1/2 lg:px-4 xl:px-6' : ''
      }`}
    >
      <div className="rounded-[28px] border border-cyan-300/18 bg-[linear-gradient(180deg,rgba(13,28,46,0.92),rgba(8,13,24,0.96))] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.32em] text-cyan-200/70">Calendario</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">
              Agenda unificada de pedidos
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-200/72">
              Cambia entre vista de un día, deslizable de 3 días o dos semanas. Todo comparte búsqueda,
              estado y fecha activa.
            </p>
          </div>

          <div className="min-w-full lg:min-w-[320px]">
            <label className="block space-y-2">
              <span className="block text-[11px] uppercase tracking-[0.28em] text-cyan-300 font-semibold">
                Buscar por nombre
              </span>
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Ej: Santa Brasa"
                className={inputBase}
              />
            </label>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <label className="block space-y-2">
            <span className="block text-[11px] uppercase tracking-[0.28em] text-cyan-300 font-semibold">
              Vista
            </span>
            <select
              value={viewMode}
              onChange={e => setViewMode(e.target.value as CalendarView)}
              className={inputBase}
            >
              <option value="day">Vista de día</option>
              <option value="scroll3">Vista deslizable 3 días</option>
              <option value="twoWeeks">Vista 2 semanas</option>
            </select>
          </label>

          <label className="block space-y-2">
            <span className="block text-[11px] uppercase tracking-[0.28em] text-cyan-300 font-semibold">
              Hub cargado
            </span>
            <select
              value={hubFilter}
              onChange={e => setHubFilter(e.target.value as HubFilter)}
              className={inputBase}
            >
              <option value="all">Todos</option>
              <option value="ok">Sí, cargado</option>
              <option value="pending">No cargado</option>
            </select>
            <p className="text-[11px] leading-5 text-white/38">
              {hubFilter === 'all'
                ? `Mostrando ${searchItems.length} pedidos`
                : hubFilter === 'ok'
                  ? `Mostrando ${okCount} pedidos cargados en hub`
                  : `Mostrando ${pendingCount} pedidos no cargados en hub`}
            </p>
          </label>

          <label className="block space-y-2">
            <span className="block text-[11px] uppercase tracking-[0.28em] text-cyan-300 font-semibold">
              Pendiente de entrega
            </span>
            <select
              value={deliveryFilter}
              onChange={e => setDeliveryFilter(e.target.value as DeliveryFilter)}
              className={inputBase}
            >
              <option value="all">Todos</option>
              <option value="no">No pendiente</option>
              <option value="yes">Sí pendiente</option>
            </select>
            <p className="text-[11px] leading-5 text-white/38">
              {deliveryFilter === 'all'
                ? `Mostrando ${searchItems.length} pedidos`
                : deliveryFilter === 'yes'
                  ? `Mostrando ${deliveryYesCount} pedidos pendientes`
                  : `Mostrando ${deliveryNoCount} pedidos no pendientes`}
            </p>
          </label>
        </div>

        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="w-full lg:max-w-[280px]">
            <label className="block space-y-2">
              <span className="block text-[11px] uppercase tracking-[0.28em] text-cyan-300 font-semibold">
                {viewMode === 'day' ? 'Día activo' : 'Inicio del bloque'}
              </span>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                onClick={openDatePicker}
                className={`${inputBase} cursor-pointer`}
              />
            </label>
          </div>

          <div className="text-xs text-white/42 lg:text-right">
            {viewMode === 'day'
              ? 'Usa esta fecha para filtrar un solo día.'
              : 'La fecha activa define el inicio del bloque visible.'}
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-300/30 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-8 text-sm text-white/58">
          Cargando calendario...
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-2 rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-4">
            <p className="text-[11px] uppercase tracking-[0.28em] text-cyan-300 font-semibold">
              {viewMode === 'day'
                ? 'Vista de día'
                : viewMode === 'scroll3'
                  ? 'Calendario deslizable 3 días'
                  : 'Vista de dos semanas'}
            </p>
            <p className="text-sm font-medium text-white/88">
              {viewMode === 'day'
                ? `Mostrando ${prettyDate(selectedDate)}`
                : viewMode === 'scroll3'
                  ? visibleRange
                    ? formatVisibleRange(visibleRange.start, visibleRange.end)
                    : 'Mostrando días'
                  : formatVisibleRange(days[0], days[days.length - 1])}
            </p>
            <p className="text-xs text-white/42">
              {viewMode === 'day'
                ? 'El filtro por fecha muestra solo ese día.'
                : viewMode === 'scroll3'
                  ? 'Desliza horizontalmente para ver más días.'
                  : 'La vista de dos semanas mantiene el filtro activo para todos los días.'}
            </p>
          </div>

          {viewMode === 'day' ? (
            <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/20 backdrop-blur-xl md:p-6">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.28em] text-cyan-300 font-semibold">Pedidos del día</p>
                  <h3 className="mt-1 text-xl font-bold text-white">{prettyDate(selectedDate)}</h3>
                </div>
                <button
                  type="button"
                  onClick={refreshItems}
                  className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70 transition hover:bg-white/[0.08] hover:text-white"
                >
                  {loading ? 'Actualizando...' : 'Actualizar'}
                </button>
              </div>

              {saveError ? (
                <div className="mb-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                  {saveError}
                </div>
              ) : null}

              {selectedDateItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-4 text-sm text-white/45">
                  No hay pedidos para este día y filtro.
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedDateItems.map(item => (
                    <div
                      key={item.agendaKey}
                      role="button"
                      tabIndex={0}
                      onClick={() => openEditor(item)}
                      onKeyDown={event => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          openEditor(item)
                        }
                      }}
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left transition hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-cyan-300/35"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <label className="mt-1 inline-flex items-center" onClick={event => event.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={item.hubOk}
                              onChange={e => {
                                e.stopPropagation()
                                updateHubStatus(item, e.target.checked)
                              }}
                              onClick={event => event.stopPropagation()}
                              className="h-4 w-4 rounded border-white/20 bg-white/10 text-cyan-400 focus:ring-cyan-400"
                            />
                          </label>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-white">{item.cliente}</p>
                            <p className="text-xs text-white/45">
                              {item.encargado || 'Sin encargado'} · {item.estado || (item.hubOk ? 'ok' : 'pendiente')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full border px-2.5 py-1 text-[11px] ${
                              item.hubOk
                                ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
                                : 'border-white/10 bg-white/5 text-white/60'
                            }`}
                          >
                            {item.hubOk ? 'Hub cargado: Sí' : 'Hub cargado: No'}
                          </span>
                          <span
                            className={`rounded-full border px-2.5 py-1 text-[11px] ${
                              normalizeDeliveryStatus(item.pendiente_de_entrega ?? item.producto_pendiente_de_entrega)
                                ? 'border-amber-300/30 bg-amber-300/10 text-amber-100'
                                : 'border-white/10 bg-white/5 text-white/60'
                            }`}
                          >
                            PDE: {yesNoLabel(normalizeDeliveryStatus(item.pendiente_de_entrega ?? item.producto_pendiente_de_entrega))}
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/60">
                            {prettyDate(item.entregar_el_dia || selectedDate)}
                          </span>
                        </div>
                      </div>
                      <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                        <p className="text-[10px] uppercase tracking-[0.22em] text-white/35">Mensaje</p>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/80">
                          {item.mensaje?.trim() || 'Sin mensaje'}
                        </p>
                      </div>
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={event => {
                            event.stopPropagation()
                            setExpandedKey(expandedKey === item.agendaKey ? null : item.agendaKey)
                          }}
                          className="text-[11px] uppercase tracking-[0.2em] text-cyan-300"
                        >
                          {expandedKey === item.agendaKey ? 'Cerrar detalle' : 'Ver mensaje'}
                        </button>
                      </div>
                      {expandedKey === item.agendaKey ? (
                        <div className="mt-3 rounded-2xl border border-white/10 bg-black/30 p-4">
                          <p className="mb-2 text-[11px] uppercase tracking-[0.24em] text-white/35">Mensaje</p>
                          <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/85">
                            {item.mensaje || 'Sin mensaje'}
                          </p>
                          {item.notas ? (
                            <p className="mt-3 text-xs text-white/45">Notas: {item.notas}</p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : viewMode === 'scroll3' ? (
            <div
              ref={scrollContainerRef}
              className="overflow-x-auto pb-3 scroll-smooth snap-x snap-mandatory"
            >
              <div className="flex min-w-max gap-3 pr-4">
                {days.map((date, index) => {
                  const dayItems = itemsByDate.get(date) ?? []
                  const hasSearch = Boolean(normalizedSearch)

                  return (
                    <article
                      key={date}
                      ref={node => {
                        dayRefs.current[index] = node
                      }}
                      role="button"
                      tabIndex={0}
                      onClick={() => openDayDetail(date)}
                      onKeyDown={event => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          openDayDetail(date)
                        }
                      }}
                      onDragOver={event => handleDayDragOver(event, date)}
                      onDragLeave={() => handleDayDragLeave(date)}
                      onDrop={event => void handleDayDrop(event, date)}
                      className={`snap-start flex-none self-start rounded-[26px] border p-4 shadow-[0_18px_50px_rgba(0,0,0,0.18)] transition ${
                        isToday(date)
                          ? 'border-amber-300/55 bg-[linear-gradient(180deg,rgba(58,41,10,0.98),rgba(22,17,6,0.98))] shadow-[0_0_0_1px_rgba(251,191,36,0.12),0_18px_50px_rgba(0,0,0,0.18),0_0_36px_rgba(245,158,11,0.2)]'
                          : 'border-white/10 bg-[linear-gradient(180deg,rgba(10,18,32,0.9),rgba(7,12,22,0.92))]'
                      } ${dragOverDate === date ? 'ring-2 ring-cyan-300/45 ring-offset-0' : ''}`}
                      style={{
                        cursor: 'pointer',
                        width: 'clamp(18rem, 31vw, 24rem)',
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className={`text-[11px] uppercase tracking-[0.22em] ${isToday(date) ? 'text-amber-100/75' : 'text-cyan-100/58'}`}>
                            {formatDayLabel(date)}
                          </p>
                          <h3 className={`mt-1 text-lg font-semibold tracking-tight ${isToday(date) ? 'text-amber-50' : 'text-white'}`}>
                            {prettyDate(date)}
                          </h3>
                        </div>

                        <button
                          type="button"
                          onClick={event => {
                            event.stopPropagation()
                            openComposer(date)
                          }}
                          className={`flex h-9 w-9 items-center justify-center rounded-full border text-lg font-semibold transition ${
                            isToday(date)
                              ? 'border-amber-200/35 bg-amber-200/12 text-amber-50 hover:bg-amber-200/18'
                              : 'border-cyan-300/25 bg-cyan-300/12 text-cyan-100 hover:bg-cyan-300/20'
                          }`}
                          aria-label={`Agregar pedido para ${prettyDate(date)}`}
                        >
                          +
                        </button>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${
                          isToday(date)
                            ? 'border-amber-200/20 bg-amber-200/10 text-amber-50/80'
                            : 'border-white/10 bg-white/[0.04] text-white/58'
                        }`}>
                          {dayItems.length} pedido{dayItems.length === 1 ? '' : 's'}
                        </span>
                      </div>

                      <div className="mt-4 space-y-2">
                        {dayItems.length > 0 ? (
                          dayItems.map((item, cardIndex) => (
                            <OrderCard
                              key={`${date}-${cardIndex}-${item.id ?? item.rowNumber ?? item.cliente}`}
                              item={item}
                              onClick={() => openEditor(item)}
                              onToggleHub={nextValue => updateHubStatus(item, nextValue)}
                              showHubToggle
                              draggable
                              dragging={draggingKey === readAgendaKey(item)}
                              onDragStart={event => handleCardDragStart(event, item)}
                              onDragEnd={handleCardDragEnd}
                            />
                          ))
                        ) : (
                          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-6 text-sm text-white/48">
                            {hasSearch ? 'Sin coincidencias para este nombre.' : 'Sin pedidos aún.'}
                          </div>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="rounded-[28px] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/55 lg:hidden">
                La vista de dos semanas está pensada para escritorio. Cambia a vista de día o deslizable
                en pantalla chica.
              </div>

              {weeks.map((week, weekIndex) => {
                const weekStart = week[0]
                const weekEnd = week[6]

                return (
                  <div key={weekStart} className="hidden space-y-3 lg:block">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.28em] text-white/42">
                          Semana {weekIndex + 1}
                        </p>
                        <p className="text-xs text-white/38">
                          {prettyDate(weekStart)} - {prettyDate(weekEnd)}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-7 2xl:gap-5">
                      {week.map(date => {
                        const dayItems = itemsByDate.get(date) ?? []
                        const hasSearch = Boolean(normalizedSearch)

                        return (
                          <article
                            key={date}
                            role="button"
                            tabIndex={0}
                            onClick={() => openDayDetail(date)}
                            onKeyDown={event => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                openDayDetail(date)
                              }
                            }}
                            onDragOver={event => handleDayDragOver(event, date)}
                            onDragLeave={() => handleDayDragLeave(date)}
                            onDrop={event => void handleDayDrop(event, date)}
                            className={`min-h-[280px] rounded-[26px] border p-5 shadow-[0_18px_50px_rgba(0,0,0,0.18)] transition lg:min-h-[360px] 2xl:min-h-[420px] ${
                              isToday(date)
                                ? 'border-amber-300/55 bg-[linear-gradient(180deg,rgba(58,41,10,0.98),rgba(22,17,6,0.98))] shadow-[0_0_0_1px_rgba(251,191,36,0.12),0_18px_50px_rgba(0,0,0,0.18),0_0_36px_rgba(245,158,11,0.2)]'
                                : 'border-white/10 bg-[linear-gradient(180deg,rgba(10,18,32,0.9),rgba(7,12,22,0.92))]'
                            } ${dragOverDate === date ? 'ring-2 ring-cyan-300/45 ring-offset-0' : ''}`}
                            style={{ cursor: 'pointer' }}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className={`text-[11px] uppercase tracking-[0.22em] ${isToday(date) ? 'text-amber-100/75' : 'text-cyan-100/58'}`}>
                                  {formatDayLabel(date)}
                                </p>
                                <h3 className={`mt-1 text-lg font-semibold tracking-tight ${isToday(date) ? 'text-amber-50' : 'text-white'}`}>
                                  {prettyDate(date)}
                                </h3>
                              </div>

                              <button
                                type="button"
                                onClick={event => {
                                  event.stopPropagation()
                                  openComposer(date)
                                }}
                                className={`flex h-9 w-9 items-center justify-center rounded-full border text-lg font-semibold transition ${
                                  isToday(date)
                                    ? 'border-amber-200/35 bg-amber-200/12 text-amber-50 hover:bg-amber-200/18'
                                    : 'border-cyan-300/25 bg-cyan-300/12 text-cyan-100 hover:bg-cyan-300/20'
                                }`}
                                aria-label={`Agregar pedido para ${prettyDate(date)}`}
                              >
                                +
                              </button>
                            </div>

                            <div className="mt-3 flex items-center justify-between">
                              <span className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${
                                isToday(date)
                                  ? 'border-amber-200/20 bg-amber-200/10 text-amber-50/80'
                                  : 'border-white/10 bg-white/[0.04] text-white/58'
                              }`}>
                                {dayItems.length} pedido{dayItems.length === 1 ? '' : 's'}
                              </span>
                            </div>

                            <div className="mt-4 space-y-2">
                              {dayItems.length > 0 ? (
                                dayItems.map((item, cardIndex) => (
                                  <OrderCard
                                    key={`${date}-${cardIndex}-${item.id ?? item.rowNumber ?? item.cliente}`}
                                    item={item}
                                    onClick={() => openEditor(item)}
                                    draggable
                                    dragging={draggingKey === readAgendaKey(item)}
                                    onDragStart={event => handleCardDragStart(event, item)}
                                    onDragEnd={handleCardDragEnd}
                                  />
                                ))
                              ) : (
                                <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-6 text-sm text-white/48">
                                  {hasSearch ? 'Sin coincidencias para este nombre.' : 'Sin pedidos aún.'}
                                </div>
                              )}
                            </div>
                          </article>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <OrderComposerModal
        key={
          modalState
            ? `${modalState.mode}-${modalState.date}-${modalState.item?.rowNumber ?? modalState.item?.id ?? 'new'}`
            : 'closed'
        }
        open={modalState !== null}
        state={modalState}
        onClose={closeComposer}
        onSaved={refreshItems}
      />

      <DayDetailModal
        open={selectedDay !== null}
        date={selectedDay}
        items={selectedDayItems}
        onClose={closeDayDetail}
        onCreate={date => {
          closeDayDetail()
          openComposer(date)
        }}
        onEdit={item => {
          closeDayDetail()
          openEditor(item)
        }}
      />
    </section>
  )
}
