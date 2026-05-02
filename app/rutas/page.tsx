'use client'
import { useMemo, useState } from 'react'

const TURNOS = ['AM1', 'AM2', 'PM1', 'PM2', 'PM3', 'PM4'] as const
const CAMIONES = ['FOTON', 'DFSK'] as const
const COLORES = ['naranja', 'azul', 'verde', 'amarilla', 'roja', 'morada'] as const

const COMUNAS = [
  'La Dehesa/Trapenses/Lo Barnechea',
  'Las Condes',
  'La Reina',
  'Vitacura',
  'Providencia',
] as const

type Turno = (typeof TURNOS)[number]
type Camion = (typeof CAMIONES)[number]
type Color = (typeof COLORES)[number]
type ComunaState = 'abierta' | 'cerrada'

type Ruta = { turno: Turno; camion: Camion; color: Color; link: string; noSale: boolean }

function getChileNow() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Santiago',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? ''
  const day = String(parseInt(get('day'), 10))
  const month = get('month')
  const hour = String(parseInt(get('hour'), 10))
  const minute = get('minute')
  return { fecha: `${day}/${month}`, hora: `${hour}:${minute}` }
}

function buildMessage(s: {
  fecha: string
  hora: string
  ruta1: Ruta
  ruta2: Ruta
  detallesR1: string
  detallesR2: string
  comunas: Record<string, ComunaState>
}) {
  const rutaLine = (n: number, r: Ruta) =>
    r.noSale
      ? `${n}. ${r.turno}-${r.camion}: NO SALE 🚫`
      : `${n}. ${r.turno}-${r.camion} - Ruta ${r.color}: ${r.link.trim()}`

  const detalleBlock = (r: Ruta, txt: string) => {
    if (r.noSale) return ''
    const t = txt.trim()
    if (!t) return ''
    return `\n${r.turno}-${r.camion}:\n${t}`
  }

  const detallesBody = [detalleBlock(s.ruta1, s.detallesR1), detalleBlock(s.ruta2, s.detallesR2)]
    .filter(Boolean)
    .join('\n')

  const comunasLines = COMUNAS.map(c => `- ${c} ${s.comunas[c] === 'abierta' ? '✅' : '🚫'}`).join('\n')

  return `*DETALLES IMPORTANTES, ULTIMA ACTUALIZACIÓN:
-🗓️ ${s.fecha}
-🕐 ${s.hora}

"Se adjunta ruta drivers, detalle de la tarde" es responsabilidad de cada uno en este grupo de estar al tanto de los detalles para reducir errores.
———————————

${rutaLine(1, s.ruta1)}

${rutaLine(2, s.ruta2)}

---------------------------
Detalles a tomar en consideración para el reparto de las rutas:
${detallesBody || '\n—'}

-----------------------------

Rutas Cerradas y abiertas para las salidas PM (no recepcionar pedidos, a menos que se consulte antes por este grupo de las siguientes zonas) Rutas abiertas: ✅
${comunasLines}`
}

const baseInput =
  'w-full bg-white/[0.06] text-white text-sm rounded-xl px-3 py-2.5 border border-white/10 focus:outline-none focus:border-purple-500 transition'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-purple-300 text-[11px] uppercase tracking-widest font-semibold mb-2">{label}</span>
      {children}
    </label>
  )
}

function RutaBlock({
  index,
  ruta,
  onChange,
}: {
  index: number
  ruta: Ruta
  onChange: (next: Ruta) => void
}) {
  const set = <K extends keyof Ruta>(k: K, v: Ruta[K]) => onChange({ ...ruta, [k]: v })

  const muted = ruta.noSale ? 'opacity-40' : ''

  return (
    <div
      className={`rounded-xl border p-4 space-y-3 transition-colors ${
        ruta.noSale ? 'bg-red-500/10 border-red-500/30' : 'bg-white/[0.03] border-white/10'
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="text-purple-300 text-[11px] uppercase tracking-widest font-semibold">Ruta {index}</p>
        <button
          type="button"
          onClick={() => set('noSale', !ruta.noSale)}
          className={`px-3 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider border transition active:scale-95 ${
            ruta.noSale
              ? 'bg-red-600 border-red-500 text-white'
              : 'bg-white/[0.05] border-white/10 text-white/60 hover:bg-white/10 hover:text-white'
          }`}
        >
          {ruta.noSale ? '🚫 No sale' : 'Marcar no sale'}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Field label="Turno">
          <select value={ruta.turno} onChange={e => set('turno', e.target.value as Turno)} className={baseInput}>
            {TURNOS.map(t => <option key={t} value={t} className="bg-slate-900">{t}</option>)}
          </select>
        </Field>
        <Field label="Camión">
          <select value={ruta.camion} onChange={e => set('camion', e.target.value as Camion)} className={baseInput}>
            {CAMIONES.map(c => <option key={c} value={c} className="bg-slate-900">{c}</option>)}
          </select>
        </Field>
        <Field label={muted ? 'Color (no se usa)' : 'Color'}>
          <select
            value={ruta.color}
            onChange={e => set('color', e.target.value as Color)}
            disabled={ruta.noSale}
            className={`${baseInput} ${muted}`}
          >
            {COLORES.map(c => <option key={c} value={c} className="bg-slate-900">{c}</option>)}
          </select>
        </Field>
      </div>

      <Field label={muted ? 'Link drivers (no se usa)' : 'Link drivers'}>
        <input
          type="url"
          value={ruta.link}
          onChange={e => set('link', e.target.value)}
          disabled={ruta.noSale}
          placeholder="https://drivers.routal.com/magic_link?..."
          className={`${baseInput} ${muted}`}
        />
      </Field>
    </div>
  )
}

export default function PlanificadorRutas() {
  const [fecha, setFecha] = useState(() => getChileNow().fecha)
  const [hora, setHora] = useState(() => getChileNow().hora)

  const [ruta1, setRuta1] = useState<Ruta>({ turno: 'AM1', camion: 'FOTON', color: 'naranja', link: '', noSale: false })
  const [ruta2, setRuta2] = useState<Ruta>({ turno: 'AM2', camion: 'DFSK', color: 'azul', link: '', noSale: false })

  const [detallesR1, setDetallesR1] = useState('')
  const [detallesR2, setDetallesR2] = useState('')

  const [comunas, setComunas] = useState<Record<string, ComunaState>>(() =>
    Object.fromEntries(COMUNAS.map(c => [c, 'abierta'])),
  )

  const [copied, setCopied] = useState(false)

  const refreshNow = () => {
    const { fecha, hora } = getChileNow()
    setFecha(fecha)
    setHora(hora)
  }

  const toggleComuna = (c: string) =>
    setComunas(prev => ({ ...prev, [c]: prev[c] === 'abierta' ? 'cerrada' : 'abierta' }))

  const message = useMemo(
    () => buildMessage({ fecha, hora, ruta1, ruta2, detallesR1, detallesR2, comunas }),
    [fecha, hora, ruta1, ruta2, detallesR1, detallesR2, comunas],
  )

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleReset = () => {
    setRuta1({ turno: 'AM1', camion: 'FOTON', color: 'naranja', link: '', noSale: false })
    setRuta2({ turno: 'AM2', camion: 'DFSK', color: 'azul', link: '', noSale: false })
    setDetallesR1('')
    setDetallesR2('')
    setComunas(Object.fromEntries(COMUNAS.map(c => [c, 'abierta'])))
    refreshNow()
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#3b0764_0%,_#0f0f1a_60%)] px-4 pt-20 pb-10 md:pt-24">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <p className="text-purple-400 text-xs uppercase tracking-[0.3em] mb-2">Despachos</p>
          <h1 className="text-4xl font-black text-white tracking-tight">Detalles de rutas</h1>
          <p className="text-white/40 text-sm mt-1">Mensaje de actualización para drivers — completá y copiá</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {/* Form */}
          <div className="bg-white/[0.05] backdrop-blur-xl rounded-2xl border border-white/10 p-5 md:p-6 space-y-6">

            {/* Fecha y hora */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-purple-400 text-xs uppercase tracking-widest font-semibold">Fecha y hora (Chile)</p>
                <button
                  type="button"
                  onClick={refreshNow}
                  className="px-3 py-1.5 rounded-lg bg-white/[0.07] border border-white/10 text-white/80 text-xs font-semibold hover:bg-white/[0.12] active:scale-95 transition"
                >
                  ↻ Actualizar
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Fecha">
                  <input
                    type="text" value={fecha}
                    onChange={e => setFecha(e.target.value)}
                    className={baseInput} placeholder="2/05"
                  />
                </Field>
                <Field label="Hora">
                  <input
                    type="text" value={hora}
                    onChange={e => setHora(e.target.value)}
                    className={baseInput} placeholder="9:30"
                  />
                </Field>
              </div>
            </div>

            {/* Rutas */}
            <div className="space-y-3">
              <p className="text-purple-400 text-xs uppercase tracking-widest font-semibold">Rutas</p>
              <RutaBlock index={1} ruta={ruta1} onChange={setRuta1} />
              <RutaBlock index={2} ruta={ruta2} onChange={setRuta2} />
            </div>

            {/* Detalles por ruta */}
            <div className="space-y-3">
              <p className="text-purple-400 text-xs uppercase tracking-widest font-semibold">Detalles a considerar</p>

              <Field label={`Ruta 1 — ${ruta1.turno} ${ruta1.camion}`}>
                <textarea
                  value={detallesR1}
                  onChange={e => setDetallesR1(e.target.value)}
                  rows={4}
                  placeholder="Ej:&#10;1. Salen ambos camiones con puntos seguidos.&#10;2. Contar facturas antes de salir."
                  className={`${baseInput} resize-y leading-relaxed`}
                />
              </Field>

              <Field label={`Ruta 2 — ${ruta2.turno} ${ruta2.camion}`}>
                <textarea
                  value={detallesR2}
                  onChange={e => setDetallesR2(e.target.value)}
                  rows={4}
                  placeholder="Detalles específicos de la ruta 2..."
                  className={`${baseInput} resize-y leading-relaxed`}
                />
              </Field>
            </div>

            {/* Comunas */}
            <div>
              <p className="text-purple-400 text-xs uppercase tracking-widest font-semibold mb-3">
                Estado de comunas (PM)
              </p>
              <div className="space-y-2">
                {COMUNAS.map(c => {
                  const state = comunas[c]
                  const open = state === 'abierta'
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleComuna(c)}
                      className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-all active:scale-[0.99] ${
                        open
                          ? 'bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/15'
                          : 'bg-red-500/10 border-red-500/30 hover:bg-red-500/15'
                      }`}
                    >
                      <span className="text-white text-sm font-medium text-left">{c}</span>
                      <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                        <span className={open ? 'text-emerald-300' : 'text-red-300'}>
                          {open ? 'Abierta' : 'Cerrada'}
                        </span>
                        <span className="text-lg leading-none">{open ? '✅' : '🚫'}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={handleReset}
              className="w-full py-2.5 rounded-xl bg-transparent border border-red-500/20 text-red-400/70 text-xs hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/40 transition"
            >
              Limpiar todo
            </button>
          </div>

          {/* Preview */}
          <div className="md:sticky md:top-24 md:self-start">
            <div className="bg-white/[0.05] backdrop-blur-xl rounded-2xl border border-white/10 p-5 md:p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <p className="text-purple-400 text-xs uppercase tracking-widest font-semibold">Previsualización</p>
                <button
                  type="button"
                  onClick={handleCopy}
                  className={`px-4 py-2 rounded-lg text-xs font-bold tracking-wide uppercase transition-all active:scale-95 ${
                    copied
                      ? 'bg-green-600 text-white'
                      : 'bg-gradient-to-r from-purple-600 to-violet-600 text-white hover:from-purple-500 hover:to-violet-500 shadow-lg shadow-purple-900/40'
                  }`}
                >
                  {copied ? '✓ Copiado' : '📋 Copiar'}
                </button>
              </div>

              <pre className="whitespace-pre-wrap break-words text-white text-sm leading-relaxed font-sans bg-black/30 rounded-xl p-4 border border-white/5 min-h-[400px]">
{message}
              </pre>

              <p className="text-white/30 text-[11px] mt-3 leading-relaxed">
                Hora y fecha vienen de zona horaria de Chile (America/Santiago). Tocá «Actualizar» para refrescar.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
