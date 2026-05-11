import type { ReactNode } from 'react'

import AdminTabs from './_components/AdminTabs'

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(31,87,122,0.42),transparent_34%),linear-gradient(180deg,#04101f_0%,#07111f_36%,#02060d_100%)] px-4 pb-14 pt-24">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.28)]">
          <p className="text-[11px] uppercase tracking-[0.32em] text-cyan-200/70">The Ice Admin</p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-6">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white">
                Panel operativo MVP
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">
                HubSpot entra por backend privado y Supabase consolida la operación. Este panel
                resuelve cliente, fecha y aprobación sin una hoja externa.
              </p>
            </div>
            <AdminTabs />
          </div>
        </header>

        <main className="mt-8">{children}</main>
      </div>
    </div>
  )
}
