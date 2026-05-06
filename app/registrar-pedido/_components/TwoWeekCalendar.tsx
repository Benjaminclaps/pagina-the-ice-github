'use client'

import { useEffect, useMemo, useState } from 'react'

const ENCARGADOS = ['Bastian', 'Gus', 'Felipe', 'Benjamin'] as const

type Encargado = (typeof ENCARGADOS)[number]

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

type Draft = {
  cliente: string
  encargado: Encargado | ''
  mensaje: string
  notas: string
  entregar_el_dia: string
}

const inputBase =
  'w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-[15px] text-white outline-none transition placeholder:text-white/25 focus:border-cyan-400 focus:bg-white/[0.09]'

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

function blankDraft(date: string): Draft {
  return {
    cliente: '',
    encargado: '',
    mensaje: '',
    notas: '',
    entregar_el_dia: date,
  }
}

function OrderCard({ item }: { item: AgendaItem }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-3 shadow-[0_12px_30px_rgba(0,0,0,0.16)]">
      <div className="flex items-start justify-between gap-2">
        <div>
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
    </article>
  )
}

function OrderComposerModal({
  open,
  date,
  onClose,
  onCreated,
}: {
  open: boolean
  date: string
  onClose: () => void
  onCreated: () => void
}) {
  const [draft, setDraft] = useState<Draft>(() => blankDraft(date))
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setDraft(blankDraft(date))
    setStatus('idle')
    setError(null)
  }, [date, open])

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft(prev => ({ ...prev, [key]: value }))

  const handleSubmit = async () => {
    setStatus('saving')
    setError(null)

    try {
      const response = await fetch('/api/agenda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente: draft.cliente.trim() || 'Sin cliente',
          encargado: draft.encargado || 'Sin asignar',
          mensaje: draft.mensaje.trim(),
          notas: draft.notas.trim(),
          entregar_el_dia: draft.entregar_el_dia,
          cargado_en_hub: false,
        }),
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error ?? 'No se pudo guardar el pedido')
      }

      setStatus('success')
      onCreated()
      onClose()
    } catch (saveError) {
      setStatus('error')
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar el pedido')
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
            <p className="text-[11px] uppercase tracking-[0.3em] text-cyan-200/70">Nuevo pedido</p>
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
              className={inputBase}
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
        </div>

        <div className="mt-6 flex flex-col gap-3 md:flex-row md:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-white/12 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white/78 transition hover:bg-white/[0.08]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 text-sm font-bold uppercase tracking-[0.18em] text-white shadow-lg shadow-cyan-950/30 transition hover:from-cyan-400 hover:to-blue-500"
          >
            {status === 'saving' ? 'Guardando...' : 'Agregar pedido'}
          </button>
        </div>

        {error ? <p className="mt-4 text-sm text-rose-200">{error}</p> : null}
      </div>
    </div>
  )
}

export default function TwoWeekCalendar({ refreshToken }: { refreshToken: number }) {
  const [items, setItems] = useState<AgendaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [modalDate, setModalDate] = useState<string | null>(null)

  const days = useMemo(() => {
    const base = todayValue()
    return Array.from({ length: 14 }, (_, index) => addDays(base, index))
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    const load = async () => {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch('/api/agenda', {
          cache: 'no-store',
          signal: controller.signal,
        })
        const payload = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(payload?.error ?? 'No se pudo cargar la agenda')
        }

        setItems(Array.isArray(payload?.items) ? payload.items : [])
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setItems([])
          setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar la agenda')
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    load()

    return () => controller.abort()
  }, [refreshToken])

  const normalizedSearch = normalize(search)

  const filteredItems = useMemo(() => {
    if (!normalizedSearch) return items

    return items.filter(item => normalize(item.cliente ?? '').includes(normalizedSearch))
  }, [items, normalizedSearch])

  const itemsByDate = useMemo(() => {
    const map = new Map<string, AgendaItem[]>()

    for (const item of filteredItems) {
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
  }, [filteredItems])

  const weeks = [days.slice(0, 7), days.slice(7, 14)]

  const openComposer = (date: string) => setModalDate(date)
  const closeComposer = () => setModalDate(null)
  const refreshItems = async () => {
    const response = await fetch('/api/agenda', { cache: 'no-store' })
    const payload = await response.json().catch(() => null)
    setItems(Array.isArray(payload?.items) ? payload.items : [])
  }

  return (
    <section className="space-y-6">
      <div className="rounded-[28px] border border-cyan-300/18 bg-[linear-gradient(180deg,rgba(13,28,46,0.92),rgba(8,13,24,0.96))] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.32em] text-cyan-200/70">Calendario</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">
              Dos semanas de pedidos
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-200/72">
              Busca por nombre del cliente y agrega pedidos directo en el día que corresponda. Cada
              cuadro muestra los pedidos cargados para esa fecha.
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
        <div className="space-y-6">
          {weeks.map((week, weekIndex) => (
            <div key={week[0]} className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] uppercase tracking-[0.28em] text-white/42">
                  Semana {weekIndex + 1}
                </p>
                <p className="text-xs text-white/38">
                  {prettyDate(week[0])} - {prettyDate(week[6])}
                </p>
              </div>

              <div className="grid gap-3 xl:grid-cols-7">
                {week.map(date => {
                  const dayItems = itemsByDate.get(date) ?? []
                  const hasSearch = Boolean(normalizedSearch)

                  return (
                    <article
                      key={date}
                      className={`min-h-[220px] rounded-[26px] border p-4 shadow-[0_18px_50px_rgba(0,0,0,0.18)] ${
                        isToday(date)
                          ? 'border-cyan-300/35 bg-[linear-gradient(180deg,rgba(16,38,63,0.96),rgba(8,13,24,0.96))]'
                          : 'border-white/10 bg-[linear-gradient(180deg,rgba(10,18,32,0.9),rgba(7,12,22,0.92))]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/58">
                            {formatDayLabel(date)}
                          </p>
                          <h3 className="mt-1 text-lg font-semibold tracking-tight text-white">
                            {prettyDate(date)}
                          </h3>
                        </div>

                        <button
                          type="button"
                          onClick={() => openComposer(date)}
                          className="flex h-9 w-9 items-center justify-center rounded-full border border-cyan-300/25 bg-cyan-300/12 text-lg font-semibold text-cyan-100 transition hover:bg-cyan-300/20"
                          aria-label={`Agregar pedido para ${prettyDate(date)}`}
                        >
                          +
                        </button>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/58">
                          {dayItems.length} pedido{dayItems.length === 1 ? '' : 's'}
                        </span>
                        {isToday(date) ? (
                          <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-emerald-100">
                            Hoy
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-4 space-y-2">
                        {dayItems.length > 0 ? (
                          dayItems.slice(0, 4).map((item, index) => (
                            <OrderCard
                              key={`${date}-${index}-${item.id ?? item.rowNumber ?? item.cliente}`}
                              item={item}
                            />
                          ))
                        ) : (
                          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-6 text-sm text-white/48">
                            {hasSearch ? 'Sin coincidencias para este nombre.' : 'Sin pedidos aún.'}
                          </div>
                        )}

                        {dayItems.length > 4 ? (
                          <p className="pt-1 text-xs text-white/40">+{dayItems.length - 4} más</p>
                        ) : null}
                      </div>
                    </article>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <OrderComposerModal
        open={modalDate !== null}
        date={modalDate ?? todayValue()}
        onClose={closeComposer}
        onCreated={refreshItems}
      />
    </section>
  )
}
