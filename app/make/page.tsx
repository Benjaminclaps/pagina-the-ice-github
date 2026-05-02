'use client'

import { useState } from 'react'

const ACCOUNTS = [
  {
    id: 'primary',
    label: 'theice@yopmail.com',
    description: 'Cuenta 1 de Make',
  },
  {
    id: 'secondary',
    label: 'logistica@theice.cl',
    description: 'Respaldo si la primera se queda sin operaciones',
  },
] as const

type MakeAccount = (typeof ACCOUNTS)[number]['id']

export default function MakeTriggerPage() {
  const [account, setAccount] = useState<MakeAccount>('primary')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<
    | { kind: 'idle'; message: string }
    | { kind: 'success'; message: string }
    | { kind: 'error'; message: string }
  >({ kind: 'idle', message: 'Listo para disparar Make.' })

  const handleTrigger = async () => {
    setLoading(true)
    setStatus({ kind: 'idle', message: 'Disparando...' })

    try {
      const response = await fetch('/api/make/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ account }),
      })

      const data = (await response.json().catch(() => null)) as
        | { ok?: boolean; message?: string; executionId?: string | null; error?: string }
        | null

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error ?? `Make respondió ${response.status}`)
      }

      setStatus({
        kind: 'success',
        message: `${data.message ?? 'Escenario Make disparado correctamente'}${data.executionId ? ` · Execution ID: ${data.executionId}` : ''}`,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo disparar Make.'
      setStatus({ kind: 'error', message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#3b0764_0%,_#0f0f1a_60%)] px-4 pt-20 pb-10 md:pt-24">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <p className="text-purple-400 text-xs uppercase tracking-[0.3em] mb-2">Automatización</p>
          <h1 className="text-4xl font-black text-white tracking-tight">Disparar Make</h1>
          <p className="text-white/40 text-sm mt-1">Elegí la cuenta y tocá el botón para lanzar el trigger manual.</p>
        </div>

        <div className="bg-white/[0.05] backdrop-blur-xl rounded-2xl border border-white/10 p-6 space-y-6">
          <div>
            <p className="text-purple-400 text-xs uppercase tracking-widest font-semibold mb-3">Elegir cuenta</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {ACCOUNTS.map(item => {
                const active = account === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setAccount(item.id)}
                    className={`text-left rounded-xl border p-4 transition-all active:scale-[0.99] ${
                      active
                        ? 'bg-purple-600/20 border-purple-500/50 text-white'
                        : 'bg-white/[0.03] border-white/10 text-white/70 hover:bg-white/[0.06] hover:border-white/20'
                    }`}
                  >
                    <p className="font-bold text-sm">{item.label}</p>
                    <p className="text-xs text-white/45 mt-1">{item.description}</p>
                  </button>
                )
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={handleTrigger}
            disabled={loading}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 text-white font-bold text-sm tracking-widest uppercase hover:from-emerald-500 hover:to-green-500 active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-emerald-900/40"
          >
            {loading ? '⏳ Disparando...' : '⚡ Disparar Make'}
          </button>

          <div
            className={`rounded-xl border p-4 text-sm ${
              status.kind === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                : status.kind === 'error'
                  ? 'bg-red-500/10 border-red-500/30 text-red-200'
                  : 'bg-white/[0.03] border-white/10 text-white/70'
            }`}
          >
            {status.message}
          </div>
        </div>
      </div>
    </div>
  )
}
