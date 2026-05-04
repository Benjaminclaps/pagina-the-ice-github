'use client'

import { useEffect, useState } from 'react'

const AGENDA_CACHE_KEY = 'pagina-the-ice.agenda-cache.v1'

function todayValue() {
  const date = new Date()
  const tzOffset = date.getTimezoneOffset() * 60000
  const local = new Date(date.getTime() - tzOffset)
  return local.toISOString().slice(0, 10)
}

function prettyDate(value: string) {
  if (!value) return 'Sin fecha'
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

const inputBase =
  'w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-[15px] text-white outline-none transition placeholder:text-white/25 focus:border-cyan-400 focus:bg-white/[0.09]'

type AgendaItem = {
  id?: string | number
  rowNumber?: string | number
  cliente: string
  encargado: string
  mensaje: string
  notas: string
  entregar_el_dia?: string
  estado?: string
  hub_ok?: boolean | string
}

type HubFilter = 'all' | 'ok' | 'pending'

type AgendaCache = {
  selectedDate?: string
  hubFilter?: HubFilter
  statusByKey?: Record<string, boolean>
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

function readCache(): AgendaCache {
  if (typeof window === 'undefined') return {}

  try {
    const raw = window.localStorage.getItem(AGENDA_CACHE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as AgendaCache
    return {
      selectedDate: typeof parsed.selectedDate === 'string' ? parsed.selectedDate : undefined,
      hubFilter:
        parsed.hubFilter === 'all' || parsed.hubFilter === 'ok' || parsed.hubFilter === 'pending'
          ? parsed.hubFilter
          : undefined,
      statusByKey:
        parsed.statusByKey && typeof parsed.statusByKey === 'object' ? parsed.statusByKey : {},
    }
  } catch {
    return {}
  }
}

function writeCache(cache: AgendaCache) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(AGENDA_CACHE_KEY, JSON.stringify(cache))
  } catch {
    // Ignore storage failures.
  }
}

export default function AgendaPage() {
  const [selectedDate, setSelectedDate] = useState(todayValue())
  const [hubFilter, setHubFilter] = useState<HubFilter>('all')
  const [items, setItems] = useState<AgendaItem[]>([])
  const [hubStatusByKey, setHubStatusByKey] = useState<Record<string, boolean>>({})
  const [loadingItems, setLoadingItems] = useState(false)
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const cache = readCache()

    if (cache.selectedDate) {
      setSelectedDate(cache.selectedDate)
    }

    if (cache.hubFilter) {
      setHubFilter(cache.hubFilter)
    }

    if (cache.statusByKey) {
      setHubStatusByKey(cache.statusByKey)
    }

    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    writeCache({
      selectedDate,
      hubFilter,
      statusByKey: hubStatusByKey,
    })
  }, [selectedDate, hubFilter, hubStatusByKey, hydrated])

  useEffect(() => {
    if (!hydrated) return
    const controller = new AbortController()

    const loadItems = async () => {
      setLoadingItems(true)
      setSaveError(null)
      try {
        const response = await fetch(`/api/agenda?date=${selectedDate}`, {
          signal: controller.signal,
          cache: 'no-store',
        })
        const data = await response.json().catch(() => null)
        const nextItems = Array.isArray(data?.items) ? data.items : []

        setItems(nextItems)
        setHubStatusByKey(prev => {
          const next = { ...prev }
          let changed = false

          nextItems.forEach((item: AgendaItem) => {
            const key = readAgendaKey(item)
            if (!(key in next)) {
              next[key] = normalizeHubStatus(item.hub_ok ?? item.estado)
              changed = true
            }
          })

          return changed ? next : prev
        })
      } catch {
        setItems([])
      } finally {
        setLoadingItems(false)
      }
    }

    loadItems()
    return () => controller.abort()
  }, [selectedDate, hydrated])

  const refreshItems = async () => {
    const controller = new AbortController()
    setLoadingItems(true)
    setSaveError(null)
    try {
      const response = await fetch(`/api/agenda?date=${selectedDate}`, {
        signal: controller.signal,
        cache: 'no-store',
      })
      const data = await response.json().catch(() => null)
      const nextItems = Array.isArray(data?.items) ? data.items : []

      setItems(nextItems)
      setHubStatusByKey(prev => {
        const next = { ...prev }
        let changed = false

        nextItems.forEach((item: AgendaItem) => {
          const key = readAgendaKey(item)
          if (!(key in next)) {
            next[key] = normalizeHubStatus(item.hub_ok ?? item.estado)
            changed = true
          }
        })

        return changed ? next : prev
      })
    } catch {
      setItems([])
    } finally {
      setLoadingItems(false)
    }
  }

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

  const viewItems = items.map(item => {
    const agendaKey = readAgendaKey(item)
    const hasCachedValue = Object.prototype.hasOwnProperty.call(hubStatusByKey, agendaKey)
    const hubOk = hasCachedValue ? hubStatusByKey[agendaKey] : normalizeHubStatus(item.hub_ok ?? item.estado)

    return {
      ...item,
      agendaKey,
      hubOk,
    }
  })

  const filteredItems = viewItems.filter(item => {
    if (hubFilter === 'ok') return item.hubOk
    if (hubFilter === 'pending') return !item.hubOk
    return true
  })

  const okCount = viewItems.filter(item => item.hubOk).length
  const pendingCount = viewItems.length - okCount

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#12304f_0%,_#08111d_55%,_#030712_100%)] px-4 pt-20 pb-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 md:pt-4">
        <header className="rounded-[28px] border border-white/10 bg-white/[0.05] px-5 py-5 shadow-2xl shadow-black/20 backdrop-blur-xl md:px-8 md:py-6">
          <p className="text-[11px] uppercase tracking-[0.32em] text-cyan-300 font-semibold">Agenda</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-white md:text-4xl">Agenda de pedidos</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/50">
            Selecciona una fecha y revisa los pedidos cargados para ese día.
          </p>
        </header>

        <section className="rounded-[28px] border border-white/10 bg-white/[0.05] p-4 shadow-2xl shadow-black/20 backdrop-blur-xl md:p-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-cyan-300 font-semibold">Calendario</p>
              <h2 className="mt-1 text-xl font-bold text-white">Pedidos por día</h2>
            </div>
            <div className="flex w-full flex-col gap-3 sm:max-w-[520px] sm:items-end">
              <div className="flex w-full flex-wrap gap-2 sm:justify-end">
                {([
                  ['all', `Todos (${viewItems.length})`],
                  ['ok', `Con OK (${okCount})`],
                  ['pending', `Pendientes (${pendingCount})`],
                ] as const).map(([value, label]) => {
                  const active = hubFilter === value
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setHubFilter(value)}
                      className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] transition ${
                        active
                          ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200'
                          : 'border-white/10 bg-white/[0.05] text-white/65 hover:bg-white/[0.08] hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
              <div className="w-full sm:max-w-[220px]">
                <label className="mb-2 block text-[11px] uppercase tracking-[0.24em] text-white/35">
                  Día activo
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className={inputBase}
                />
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-3xl border border-white/10 bg-black/25 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-white">
                {prettyDate(selectedDate)} - pedidos del día
              </p>
              <button
                type="button"
                onClick={refreshItems}
                className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70 transition hover:bg-white/[0.08] hover:text-white"
              >
                {loadingItems ? 'Actualizando...' : 'Actualizar'}
              </button>
            </div>
            <p className="mb-3 text-xs text-white/40">
              {loadingItems ? 'Actualizando pedidos...' : `${items.length} pedidos`}
            </p>
            {saveError ? (
              <div className="mb-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                {saveError}
              </div>
            ) : null}

            {filteredItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-4 text-sm text-white/45">
                No hay pedidos para este filtro en este día.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredItems.map(item => (
                  <div
                    key={item.agendaKey}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left transition hover:bg-white/[0.06]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <label className="mt-1 inline-flex items-center">
                          <input
                            type="checkbox"
                            checked={item.hubOk}
                            onChange={e => updateHubStatus(item, e.target.checked)}
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
                          {item.hubOk ? 'Hub OK' : 'Pendiente'}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/60">
                          {prettyDate(item.entregar_el_dia || selectedDate)}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => setExpandedKey(expandedKey === item.agendaKey ? null : item.agendaKey)}
                        className="text-[11px] uppercase tracking-[0.2em] text-cyan-300"
                      >
                        {expandedKey === item.agendaKey ? 'Cerrar detalle' : 'Ver mensaje'}
                      </button>
                    </div>
                    {expandedKey === item.agendaKey ? (
                      <div className="mt-3 rounded-2xl border border-white/10 bg-black/30 p-4">
                        <p className="text-[11px] uppercase tracking-[0.24em] text-white/35 mb-2">Mensaje</p>
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
        </section>
      </div>
    </div>
  )
}
