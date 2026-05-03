'use client'

import { useEffect, useMemo, useState } from 'react'

const ENCARGADOS = ['Bastian', 'Gus', 'Felipe', 'Benjamin'] as const

type Encargado = (typeof ENCARGADOS)[number]

function todayValue() {
  const date = new Date()
  const tzOffset = date.getTimezoneOffset() * 60000
  const local = new Date(date.getTime() - tzOffset)
  return local.toISOString().slice(0, 10)
}

function offsetDateValue(offsetDays: number) {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  const tzOffset = date.getTimezoneOffset() * 60000
  const local = new Date(date.getTime() - tzOffset)
  return local.toISOString().slice(0, 10)
}

function prettyDate(value: string) {
  if (!value) return 'Sin fecha'
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

type Draft = {
  cliente: string
  encargado: Encargado | ''
  mensaje: string
  notas: string
}

type AgendaItem = {
  cliente: string
  encargado: string
  mensaje: string
  notas: string
  entregar_el_dia?: string
  estado?: string
}

const emptyDraft = (): Draft => ({
  cliente: '',
  encargado: '',
  mensaje: '',
  notas: '',
})

function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: React.ReactNode
  hint?: string
}) {
  return (
    <label className="block space-y-2">
      <span className="block text-[11px] uppercase tracking-[0.28em] text-cyan-300 font-semibold">
        {label}
      </span>
      {children}
      {hint ? <span className="block text-[11px] text-white/35 leading-relaxed">{hint}</span> : null}
    </label>
  )
}

const inputBase =
  'w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-[15px] text-white outline-none transition placeholder:text-white/25 focus:border-cyan-400 focus:bg-white/[0.09]'

export default function AgendaPage() {
  const [draft, setDraft] = useState<Draft>(() => emptyDraft())
  const [saved, setSaved] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const [selectedDate, setSelectedDate] = useState(todayValue())
  const [items, setItems] = useState<AgendaItem[]>([])
  const [loadingItems, setLoadingItems] = useState(false)
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft(prev => ({ ...prev, [key]: value }))

  const payload = useMemo(() => {
    return {
      cliente: draft.cliente.trim() || 'Sin cliente',
      encargado: draft.encargado || 'Sin asignar',
      mensaje: draft.mensaje.trim(),
      notas: draft.notas.trim(),
      entregar_el_dia: selectedDate,
    }
  }, [draft, selectedDate])

  const handleSubmit = async () => {
    setStatus('saving')
    try {
      const response = await fetch('/api/agenda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error('No se pudo guardar el pedido')
      }

      setSaved(true)
      setStatus('success')
      setDraft(emptyDraft())
      setTimeout(() => setSaved(false), 1800)
    } catch {
      setStatus('error')
      setSaved(false)
    }
  }

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
          <h1 className="mt-2 text-3xl font-black tracking-tight text-white md:text-4xl">
            Captura de pedidos
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/50">
            Selecciona fecha, escribe el cliente y pega el mensaje. El registro se va a Google Sheets con un solo submit.
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

          <div className="flex flex-wrap gap-2">
            {[0, 1, 2, 3, 4, 5, 6].map(offset => {
              const value = offsetDateValue(offset)
              const date = new Date(`${value}T12:00:00`)
              const label = date.toLocaleDateString('es-CL', {
                weekday: 'short',
                day: '2-digit',
                month: '2-digit',
              })
              const active = value === selectedDate

              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSelectedDate(value)}
                  className={`rounded-2xl border px-3 py-2 text-left transition active:scale-[0.99] ${
                    active
                      ? 'border-cyan-400/50 bg-cyan-400/15 text-white'
                      : 'border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.06] hover:text-white'
                  }`}
                >
                  <p className="text-[11px] uppercase tracking-[0.2em] opacity-70">{label}</p>
                </button>
              )
            })}
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

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-[28px] border border-white/10 bg-white/[0.05] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl md:p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-cyan-300 font-semibold">Formulario</p>
                <h2 className="mt-1 text-xl font-bold text-white">Nuevo pedido</h2>
              </div>
              <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold text-cyan-200">
                Mobile first
              </span>
            </div>

            <div className="space-y-4">
              <Field label="Cliente" hint="Escribe el nombre directo del cliente.">
                <input
                  type="text"
                  value={draft.cliente}
                  onChange={e => update('cliente', e.target.value)}
                  placeholder="Ej: La Ostia"
                  className={inputBase}
                />
              </Field>

              <Field label="Entregar el día" hint="El día que debe caer en el filtro y en la hoja.">
                <input
                  type="text"
                  value={prettyDate(selectedDate)}
                  readOnly
                  className={`${inputBase} cursor-not-allowed opacity-90`}
                />
              </Field>

              <Field label="Encargado" hint="Selecciona quién lo cargó.">
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
              </Field>

              <Field label="Mensaje pegado" hint="Pega el mensaje tal como lo mandan por WhatsApp.">
                <textarea
                  value={draft.mensaje}
                  onChange={e => update('mensaje', e.target.value)}
                  placeholder="Ej: La Ostia pidió 12 kg para el lunes..."
                  rows={6}
                  className={`${inputBase} resize-none`}
                />
              </Field>

              <Field label="Notas" hint="Observaciones internas o excepciones.">
                <input
                  type="text"
                  value={draft.notas}
                  onChange={e => update('notas', e.target.value)}
                  placeholder="Ej: entregar antes de las 10"
                  className={inputBase}
                />
              </Field>

              <button
                type="button"
                onClick={handleSubmit}
                className="w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3.5 text-sm font-bold uppercase tracking-[0.2em] text-white shadow-lg shadow-cyan-950/30 transition active:scale-[0.99] hover:from-cyan-400 hover:to-blue-500"
              >
                {status === 'saving' ? 'Guardando...' : saved ? 'Guardado' : 'Guardar en Sheets'}
              </button>
            </div>
            <p
              className={`mt-3 text-xs ${
                status === 'success'
                  ? 'text-emerald-300'
                  : status === 'error'
                    ? 'text-red-300'
                    : 'text-white/40'
              }`}
            >
              {status === 'success'
                ? 'Pedido listo para escribir en Sheets.'
                : status === 'error'
                  ? 'No se pudo enviar el pedido. Revisa el endpoint.'
                  : 'El submit enviará el pedido a la API que conecte con Sheets.'}
            </p>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-black/25 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl md:p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.28em] text-cyan-300 font-semibold">Vista previa</p>
                <h2 className="mt-1 text-xl font-bold text-white">Así irá a Sheets</h2>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/60">
                {prettyDate(selectedDate)}
              </span>
            </div>

            <div className="space-y-3 rounded-3xl border border-white/10 bg-white/[0.04] p-4">
              <PreviewRow label="Cliente" value={payload.cliente} />
              <PreviewRow label="Entregar el día" value={prettyDate(selectedDate)} />
              <PreviewRow label="Encargado" value={payload.encargado} />
              <PreviewBlock label="Mensaje" value={payload.mensaje || 'Sin mensaje'} />
              <PreviewBlock label="Notas" value={payload.notas || 'Sin notas'} />
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/55">
              El submit puede mandar esta data a un endpoint que escriba la fila en Google Sheets. Si quieres,
              el siguiente paso es conectar este formulario con Apps Script.
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/5 pb-2 last:border-0 last:pb-0">
      <span className="text-[11px] uppercase tracking-[0.24em] text-white/35">{label}</span>
      <span className="text-right text-sm font-medium text-white/90">{value}</span>
    </div>
  )
}

function PreviewBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <span className="block text-[11px] uppercase tracking-[0.24em] text-white/35">{label}</span>
      <p className="whitespace-pre-wrap rounded-2xl border border-white/5 bg-black/30 p-3 text-sm leading-relaxed text-white/85">
        {value}
      </p>
    </div>
  )
}
