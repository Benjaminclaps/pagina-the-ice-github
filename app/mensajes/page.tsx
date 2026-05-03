'use client'
import { useMemo, useState } from 'react'

const CAMIONES = ['FOTON', 'DFSK', 'JMC'] as const
const TURNOS = ['AM1', 'AM2', 'AM3', 'PM1', 'PM2', 'PM3', 'PM4'] as const
const DRIVERS = ['Cris', 'Hernán', 'Gus', 'Seba', 'Felipe'] as const
const CUSTOM_PRODUCTS = [
  'cubo 5x5',
  'esfera grande',
  'esfera chica',
  'collins',
  'the big tall',
  'prisma/hexágono',
] as const

type Camion = (typeof CAMIONES)[number]
type Turno = (typeof TURNOS)[number]

type CargaKey = 'ORIGINAL' | 'MINIS' | 'ZIPPER ORIGINAL' | 'ZIPPER MINI' | 'ESCAMA' | 'TUBO SÓLIDO'
const CARGA_KEYS: CargaKey[] = ['ORIGINAL', 'MINIS', 'ZIPPER ORIGINAL', 'ZIPPER MINI', 'ESCAMA', 'TUBO SÓLIDO']

type CustomLine = { product: string; qty: number; mode: 'preset' | 'custom' }

const emptyCarga = (): Record<CargaKey, number> =>
  Object.fromEntries(CARGA_KEYS.map(k => [k, 0])) as Record<CargaKey, number>

function joinDrivers(list: string[]) {
  if (list.length === 0) return ''
  if (list.length === 1) return list[0]
  if (list.length === 2) return `${list[0]} y ${list[1]}`
  return `${list.slice(0, -1).join(', ')} y ${list[list.length - 1]}`
}

function buildMessage(s: {
  camion: Camion
  turno: Turno
  drivers: string[]
  puntos: string
  kilos: string
  carga: Record<CargaKey, number>
  customs: CustomLine[]
  horaCargaLista: string
  horaSalida: string
}) {
  const driversTxt = joinDrivers(s.drivers)
  const cargaTxt = CARGA_KEYS.map(k => `${k}: ${s.carga[k] || 0}`).join('\n')
  const validCustoms = s.customs.filter(c => c.product && c.qty > 0)
  const customsBlock = validCustoms.length
    ? `\n\n🧊 CUSTOM:\n${validCustoms.map(c => `- ${c.qty} ${c.product}`).join('\n')}`
    : ''

  return `🚚${s.camion} - ${s.turno}
👤 ${driversTxt}
📍 ${s.puntos || 0} puntos
⚖️ ${s.kilos || 0}

🧊Carga Estándar:
${cargaTxt}${customsBlock}

⏱️ CARGA LISTA: ${s.horaCargaLista}
🛻 SALIDA: ${s.horaSalida}`
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-purple-300 text-[11px] uppercase tracking-widest font-semibold mb-2">{label}</span>
      {children}
    </label>
  )
}

const baseInput =
  'w-full bg-white/[0.06] text-white text-sm rounded-xl px-3 py-2.5 border border-white/10 focus:outline-none focus:border-purple-500 transition'

export default function PlanificadorMensajes() {
  const [camion, setCamion] = useState<Camion>('FOTON')
  const [turno, setTurno] = useState<Turno>('PM1')
  const [drivers, setDrivers] = useState<string[]>([])
  const [puntos, setPuntos] = useState('')
  const [kilos, setKilos] = useState('')
  const [carga, setCarga] = useState<Record<CargaKey, number>>(emptyCarga())
  const [customs, setCustoms] = useState<CustomLine[]>([])
  const [horaCargaLista, setHoraCargaLista] = useState('')
  const [horaSalida, setHoraSalida] = useState('')
  const [copied, setCopied] = useState(false)

  const toggleDriver = (d: string) =>
    setDrivers(prev => (prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]))

  const updateCarga = (k: CargaKey, v: number) =>
    setCarga(prev => ({ ...prev, [k]: Math.max(0, v) }))

  const addCustom = () => setCustoms(prev => [...prev, { product: '', qty: 1, mode: 'preset' }])
  const updateCustom = (i: number, field: keyof CustomLine, value: string | number) =>
    setCustoms(prev => prev.map((l, idx) => (idx === i ? { ...l, [field]: value } : l)))
  const removeCustom = (i: number) => setCustoms(prev => prev.filter((_, idx) => idx !== i))

  const message = useMemo(
    () => buildMessage({ camion, turno, drivers, puntos, kilos, carga, customs, horaCargaLista, horaSalida }),
    [camion, turno, drivers, puntos, kilos, carga, customs, horaCargaLista, horaSalida],
  )

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleReset = () => {
    setCamion('FOTON')
    setTurno('PM1')
    setDrivers([])
    setPuntos('')
    setKilos('')
    setCarga(emptyCarga())
    setCustoms([])
    setHoraCargaLista('')
    setHoraSalida('')
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#3b0764_0%,_#0f0f1a_60%)] px-4 pt-20 pb-10 md:pt-24">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <p className="text-purple-400 text-xs uppercase tracking-[0.3em] mb-2">Despachos</p>
          <h1 className="text-4xl font-black text-white tracking-tight">Planificador de mensajes</h1>
          <p className="text-white/40 text-sm mt-1">WhatsApp de cargas — completá y copiá</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {/* Form */}
          <div className="bg-white/[0.05] backdrop-blur-xl rounded-2xl border border-white/10 p-5 md:p-6 space-y-6">
            <p className="text-purple-400 text-xs uppercase tracking-widest font-semibold">Datos del despacho</p>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Camión">
                <select value={camion} onChange={e => setCamion(e.target.value as Camion)} className={baseInput}>
                  {CAMIONES.map(c => <option key={c} value={c} className="bg-slate-900">{c}</option>)}
                </select>
              </Field>
              <Field label="Turno">
                <select value={turno} onChange={e => setTurno(e.target.value as Turno)} className={baseInput}>
                  {TURNOS.map(t => <option key={t} value={t} className="bg-slate-900">{t}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Drivers">
              <div className="flex flex-wrap gap-2">
                {DRIVERS.map(d => {
                  const active = drivers.includes(d)
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDriver(d)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all active:scale-95 ${
                        active
                          ? 'bg-purple-600 border-purple-500 text-white'
                          : 'bg-white/[0.05] border-white/10 text-white/60 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {d}
                    </button>
                  )
                })}
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Puntos">
                <input
                  type="number" min={0} max={50} inputMode="numeric"
                  value={puntos} onChange={e => setPuntos(e.target.value)}
                  className={baseInput} placeholder="8"
                />
              </Field>
              <Field label="Kilos totales">
                <input
                  type="number" min={0} inputMode="numeric"
                  value={kilos} onChange={e => setKilos(e.target.value)}
                  className={baseInput} placeholder="942"
                />
              </Field>
            </div>

            <div>
              <p className="text-purple-300 text-[11px] uppercase tracking-widest font-semibold mb-3">Carga estándar</p>
              <div className="space-y-2">
                {CARGA_KEYS.map(k => (
                  <div key={k} className="flex items-center gap-3 bg-white/[0.03] rounded-lg px-3 py-2 border border-white/5">
                    <span className="text-white/80 text-xs flex-1 font-medium">{k}</span>
                    <button
                      type="button"
                      onClick={() => updateCarga(k, carga[k] - 1)}
                      className="w-8 h-8 rounded-full bg-white/10 text-white text-base hover:bg-white/20 active:scale-95 transition flex items-center justify-center"
                    >−</button>
                    <input
                      type="number" min={0} inputMode="numeric"
                      value={carga[k] || ''}
                      onChange={e => updateCarga(k, parseInt(e.target.value || '0', 10))}
                      className="w-14 bg-white/5 text-white text-sm rounded-md px-2 py-1 border border-white/10 text-center tabular-nums focus:outline-none focus:border-purple-500"
                      placeholder="0"
                    />
                    <button
                      type="button"
                      onClick={() => updateCarga(k, carga[k] + 1)}
                      className="w-8 h-8 rounded-full bg-purple-600 text-white text-base hover:bg-purple-500 active:scale-95 transition flex items-center justify-center"
                    >+</button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-purple-300 text-[11px] uppercase tracking-widest font-semibold">Custom</p>
                <span className="text-white/30 text-xs">{customs.length} {customs.length === 1 ? 'línea' : 'líneas'}</span>
              </div>

              {customs.length > 0 && (
                <div className="space-y-2 mb-3">
                {customs.map((line, i) => (
                  <div key={i} className="flex gap-2 items-center bg-white/[0.03] rounded-lg p-2 border border-white/5">
                      <select
                        value={line.mode}
                        onChange={e => {
                          const mode = e.target.value as CustomLine['mode']
                          updateCustom(i, 'mode', mode)
                          if (mode === 'preset' && !CUSTOM_PRODUCTS.includes(line.product as (typeof CUSTOM_PRODUCTS)[number])) {
                            updateCustom(i, 'product', '')
                          }
                          if (mode === 'custom' && line.product && CUSTOM_PRODUCTS.includes(line.product as (typeof CUSTOM_PRODUCTS)[number])) {
                            updateCustom(i, 'product', '')
                          }
                        }}
                        className="w-28 bg-white/10 text-white text-xs rounded-md px-2 py-1.5 border border-white/10 focus:outline-none focus:border-purple-500"
                      >
                        <option value="preset" className="bg-slate-900">Predefinido</option>
                        <option value="custom" className="bg-slate-900">Redactar</option>
                      </select>
                      {line.mode === 'preset' ? (
                        <select
                          value={line.product}
                          onChange={e => updateCustom(i, 'product', e.target.value)}
                          className="flex-1 bg-white/10 text-white text-xs rounded-md px-2 py-1.5 border border-white/10 focus:outline-none focus:border-purple-500"
                        >
                          <option value="" className="bg-slate-900">Seleccionar...</option>
                          {CUSTOM_PRODUCTS.map(p => (
                            <option key={p} value={p} className="bg-slate-900">{p}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={line.product}
                          onChange={e => updateCustom(i, 'product', e.target.value)}
                          className="flex-1 bg-white/10 text-white text-xs rounded-md px-2 py-1.5 border border-white/10 focus:outline-none focus:border-purple-500"
                          placeholder="Escribe el producto"
                        />
                      )}
                      <input
                        type="number" min={1} inputMode="numeric"
                        value={line.qty || ''}
                        onChange={e => updateCustom(i, 'qty', parseInt(e.target.value || '0', 10))}
                        className="w-16 bg-white/5 text-white text-sm rounded-md px-2 py-1 border border-white/10 text-center tabular-nums focus:outline-none focus:border-purple-500"
                        placeholder="qty"
                      />
                      <button
                        type="button"
                        onClick={() => removeCustom(i)}
                        className="w-7 h-7 flex items-center justify-center text-white/40 hover:text-red-400 transition text-lg leading-none"
                      >×</button>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={addCustom}
                className="w-full py-2.5 rounded-xl border border-dashed border-white/15 text-white/40 hover:text-white/70 hover:border-white/30 transition text-xs"
              >
                + Agregar producto custom
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Carga lista">
                <input
                  type="text" value={horaCargaLista}
                  onChange={e => setHoraCargaLista(e.target.value)}
                  className={baseInput} placeholder="3:00"
                />
              </Field>
              <Field label="Salida">
                <input
                  type="text" value={horaSalida}
                  onChange={e => setHoraSalida(e.target.value)}
                  className={baseInput} placeholder="3:05"
                />
              </Field>
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
                El mensaje se actualiza en tiempo real. Si una línea de custom no tiene producto o cantidad &gt; 0, se omite.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
