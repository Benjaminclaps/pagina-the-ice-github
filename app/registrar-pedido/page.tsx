'use client'

import { useState } from 'react'

const ENCARGADOS = ['Bastian', 'Gus', 'Felipe', 'Benjamin'] as const

type Encargado = (typeof ENCARGADOS)[number]

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

type Draft = {
  cliente: string
  encargado: Encargado | ''
  mensaje: string
  notas: string
}

const emptyDraft = (): Draft => ({
  cliente: '',
  encargado: '',
  mensaje: '',
  notas: '',
})

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block space-y-2">
      <span className="block text-[11px] uppercase tracking-[0.28em] text-cyan-300 font-semibold">{label}</span>
      {children}
      {hint ? <span className="block text-[11px] text-white/35 leading-relaxed">{hint}</span> : null}
    </label>
  )
}

const inputBase =
  'w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-[15px] text-white outline-none transition placeholder:text-white/25 focus:border-cyan-400 focus:bg-white/[0.09]'

export default function RegistrarPedidoPage() {
  const [draft, setDraft] = useState<Draft>(() => emptyDraft())
  const [selectedDate, setSelectedDate] = useState(todayValue())
  const [saved, setSaved] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft(prev => ({ ...prev, [key]: value }))

  const handleSubmit = async () => {
    setStatus('saving')
    try {
      const response = await fetch('/api/agenda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente: draft.cliente.trim() || 'Sin cliente',
          encargado: draft.encargado || 'Sin asignar',
          mensaje: draft.mensaje.trim(),
          notas: draft.notas.trim(),
          entregar_el_dia: selectedDate,
          cargado_en_hub: false,
        }),
      })

      if (!response.ok) throw new Error('No se pudo guardar el pedido')

      setSaved(true)
      setStatus('success')
      setDraft(emptyDraft())
      setTimeout(() => setSaved(false), 1800)
    } catch {
      setStatus('error')
      setSaved(false)
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#12304f_0%,_#08111d_55%,_#030712_100%)] px-4 pt-20 pb-10">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 md:pt-4">
        <header className="rounded-[28px] border border-white/10 bg-white/[0.05] px-5 py-5 shadow-2xl shadow-black/20 backdrop-blur-xl md:px-8 md:py-6">
          <p className="text-[11px] uppercase tracking-[0.32em] text-cyan-300 font-semibold">Agenda</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-white md:text-4xl">Registrar pedido</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/50">
            Completa el formulario y lo guardas directo en Google Sheets.
          </p>
        </header>

        <section className="rounded-[28px] border border-white/10 bg-white/[0.05] p-5 shadow-2xl shadow-black/20 backdrop-blur-xl md:p-6">
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

            <Field label="Entregar el día" hint="Selecciona el día para el pedido.">
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className={inputBase}
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
            <p
              className={`text-xs ${
                status === 'success'
                  ? 'text-emerald-300'
                  : status === 'error'
                    ? 'text-red-300'
                    : 'text-white/40'
              }`}
            >
              {status === 'success'
                ? `Pedido enviado para ${prettyDate(selectedDate)}.`
                : status === 'error'
                  ? 'No se pudo enviar el pedido. Revisa el endpoint.'
                  : 'El pedido se enviará a Google Sheets al tocar el botón.'}
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
