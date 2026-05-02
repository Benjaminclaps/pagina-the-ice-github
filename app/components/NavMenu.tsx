'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

const LINKS = [
  { href: '/', label: 'The Ice Counter', sub: 'Contador de facturas' },
  { href: '/make', label: 'Disparar Make', sub: 'Trigger manual de automatización' },
  { href: '/mensajes', label: 'Planificador de mensajes', sub: 'WhatsApp de cargas' },
  { href: '/rutas', label: 'Detalles de rutas', sub: 'WhatsApp de actualización' },
] as const

export default function NavMenu() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Abrir menú"
        className="fixed top-4 left-4 z-40 w-11 h-11 rounded-xl bg-white/[0.07] backdrop-blur-xl border border-white/10 flex flex-col items-center justify-center gap-[5px] hover:bg-white/[0.12] active:scale-95 transition-all"
      >
        <span className="block w-5 h-[2px] bg-white rounded-full" />
        <span className="block w-5 h-[2px] bg-white rounded-full" />
        <span className="block w-5 h-[2px] bg-white rounded-full" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <div
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]"
          />
          <div className="absolute left-0 top-0 bottom-0 w-full max-w-xs bg-[radial-gradient(ellipse_at_top_left,_#3b0764_0%,_#0f0f1a_70%)] border-r border-white/10 p-6 animate-[slideIn_0.2s_ease-out]">
            <div className="flex items-center justify-between mb-8">
              <p className="text-purple-400 text-xs uppercase tracking-[0.3em] font-semibold">Navegación</p>
              <button
                onClick={() => setOpen(false)}
                aria-label="Cerrar menú"
                className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xl leading-none flex items-center justify-center transition"
              >
                ×
              </button>
            </div>

            <nav className="space-y-2">
              {LINKS.map(link => {
                const active = pathname === link.href
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className={`block rounded-xl px-4 py-3 border transition-all ${
                      active
                        ? 'bg-purple-600/20 border-purple-500/40 text-white'
                        : 'bg-white/[0.03] border-white/10 text-white/80 hover:bg-white/[0.07] hover:border-white/20'
                    }`}
                  >
                    <p className="text-sm font-bold tracking-tight">{link.label}</p>
                    <p className="text-white/40 text-xs mt-0.5">{link.sub}</p>
                  </Link>
                )
              })}
            </nav>

            <p className="text-white/20 text-[10px] uppercase tracking-widest mt-10">The Ice · Operaciones</p>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideIn { from { transform: translateX(-100%) } to { transform: translateX(0) } }
      `}</style>
    </>
  )
}
