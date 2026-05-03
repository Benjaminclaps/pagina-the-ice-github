'use client'

import { useEffect, useState } from 'react'

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
  cliente: string
  encargado: string
  mensaje: string
  notas: string
  entregar_el_dia?: string
  estado?: string
}

export default function AgendaPage() {
  const [selectedDate, setSelectedDate] = useState(todayValue())
  const [items, setItems] = useState<AgendaItem[]>([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    const loadItems = async () => {
      setLoadingItems(true)
      try {
        const response = await fetch(`/api/agenda?date=${selectedDate}`, {
          signal: controller.signal,
        })
        const data = await response.json().catch(() => null)
        setItems(Array.isArray(data?.items) ? data.items : [])
      } catch {
        setItems([])
      } finally {
        setLoadingItems(false)
      }
    }

    loadItems()
    return () => controller.abort()
  }, [selectedDate])

  const refreshItems = async () => {
    const controller = new AbortController()
    setLoadingItems(true)
    try {
      const response = await fetch(`/api/agenda?date=${selectedDate}`, {
        signal: controller.signal,
      })
      const data = await response.json().catch(() => null)
      setItems(Array.isArray(data?.items) ? data.items : [])
    } catch {
      setItems([])
    } finally {
      setLoadingItems(false)
    }
  }

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
            <div className="w-full sm:max-w-[220px]">
              <label className="block text-[11px] uppercase tracking-[0.24em] text-white/35 mb-2">Día activo</label>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className={inputBase}
              />
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

            {items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-4 text-sm text-white/45">
                No hay pedidos cargados para este día todavía.
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item, index) => (
                  <button
                    key={`${item.entregar_el_dia || selectedDate}-${index}`}
                    type="button"
                    onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left transition hover:bg-white/[0.06]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-white">{item.cliente}</p>
                        <p className="text-xs text-white/45">
                          {item.encargado || 'Sin encargado'} · {item.estado || 'Sin estado'}
                        </p>
                      </div>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/60">
                        {prettyDate(item.entregar_el_dia || selectedDate)}
                      </span>
                    </div>
                    <p className="mt-2 text-[11px] uppercase tracking-[0.2em] text-cyan-300">
                      {expandedIndex === index ? 'Tocar para cerrar' : 'Tocar para ver mensaje'}
                    </p>
                    {expandedIndex === index ? (
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
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
