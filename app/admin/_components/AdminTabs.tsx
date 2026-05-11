'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/admin/pedidos', label: 'Pedidos', sub: 'Bandeja operativa' },
  { href: '/admin/clientes', label: 'Clientes', sub: 'Directorio y alta' },
  { href: '/admin/historial', label: 'Historial', sub: 'Pedidos y estados' },
] as const

export default function AdminTabs() {
  const pathname = usePathname()

  return (
    <nav className="flex flex-wrap gap-3">
      {LINKS.map(link => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`)

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-2xl border px-4 py-3 transition ${
              active
                ? 'border-cyan-300/40 bg-cyan-300/14 text-white'
                : 'border-white/10 bg-white/[0.04] text-white/78 hover:border-white/20 hover:bg-white/[0.07]'
            }`}
          >
            <p className="text-sm font-semibold tracking-tight">{link.label}</p>
            <p className="mt-0.5 text-xs text-white/45">{link.sub}</p>
          </Link>
        )
      })}
    </nav>
  )
}
