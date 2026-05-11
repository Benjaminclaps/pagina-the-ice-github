'use client'

import Link from 'next/link'
import { startTransition, useEffect, useRef, useState } from 'react'

type TicketSummary = {
  groupKey: string
  threadId: string
  previewText: string
  lastMessageAt: string
  receivedAt: string
  messageCount: number
  orderId: string | null
  orderStatus: string | null
  portalLoaded: boolean
  status: 'open' | 'ordered' | 'portal_loaded' | 'resolved_no_order'
}

type CustomerInboxItem = {
  id: string
  phone: string
  display_name: string
  razon_social: string | null
  status: string
  updated_at: string
  ticketCount: number
  openTicketCount: number
  lastActivityAt: string | null
  lastPreviewText: string | null
  latestTicket: TicketSummary | null
  tickets: TicketSummary[]
}

type InboxResponse = {
  items: CustomerInboxItem[]
}

type SyncSummary = {
  importedMessages: number
  groupedTickets: number
  threadsProcessed: number
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

function clip(text: string, size = 150) {
  if (text.length <= size) return text
  return `${text.slice(0, size)}...`
}

export default function PedidosBoard() {
  const [items, setItems] = useState<CustomerInboxItem[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [syncSummary, setSyncSummary] = useState<SyncSummary | null>(null)
  const syncingRef = useRef(false)

  const loadInbox = async () => {
    setError(null)
    setLoading(true)

    try {
      const response = await fetch('/api/admin/customers/inbox?limit=80', {
        cache: 'no-store',
      })
      const data = (await response.json().catch(() => null)) as InboxResponse | null

      if (!response.ok) {
        throw new Error((data as { error?: string } | null)?.error ?? 'No se pudo cargar la bandeja')
      }

      setItems(Array.isArray(data?.items) ? data.items : [])
    } catch (loadError) {
      setItems([])
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar la bandeja')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadInbox()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [])

  const runSync = async () => {
    if (syncingRef.current) return

    syncingRef.current = true
    setSyncing(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/hubspot/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          threadLimit: 50,
          messageLimit: 50,
        }),
      })
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(data?.error ?? 'No se pudo sincronizar HubSpot')
      }

      setSyncSummary({
        importedMessages: Number(data?.importedMessages ?? 0),
        groupedTickets: Number(data?.groupedTickets ?? 0),
        threadsProcessed: Number(data?.threadsProcessed ?? 0),
      })

      startTransition(() => {
        void loadInbox()
      })
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : 'No se pudo sincronizar HubSpot')
    } finally {
      syncingRef.current = false
      setSyncing(false)
    }
  }

  useEffect(() => {
    void runSync()

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void runSync()
      }
    }, 15000)

    return () => window.clearInterval(interval)
  }, [])

  return (
    <section className="space-y-6">
      <div className="grid gap-4 md:grid-cols-[1.35fr_0.65fr]">
        <div className="rounded-[28px] border border-cyan-300/20 bg-[linear-gradient(135deg,rgba(22,53,82,0.92),rgba(7,14,28,0.88))] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-cyan-200/70">
            Intake operativo
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">Locales y tickets</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200/72">
            Esta bandeja agrupa todo por local. El card con punto verde es el local con actividad
            nueva; si ya fue atendido, baja y queda en rojo con su historial.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              onClick={runSync}
              disabled={syncing}
              className="rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:bg-cyan-300/50"
            >
              {syncing ? 'Sincronizando...' : 'Sincronizar HubSpot'}
            </button>
            <button
              onClick={() => startTransition(() => void loadInbox())}
              className="rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white/82 transition hover:border-white/22 hover:bg-white/[0.08]"
            >
              Refrescar bandeja
            </button>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-[28px] border border-white/10 bg-white/[0.05] p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-white/45">Locales</p>
            <p className="mt-3 text-4xl font-semibold tracking-tight text-white">{items.length}</p>
            <p className="mt-2 text-sm text-white/58">
              Locales con historial de tickets y pedidos.
            </p>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/[0.05] p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-white/45">Último sync</p>
            {syncSummary ? (
              <div className="mt-3 space-y-2 text-sm text-white/72">
                <p>{syncSummary.importedMessages} mensajes nuevos</p>
                <p>{syncSummary.groupedTickets} tickets generados</p>
                <p>{syncSummary.threadsProcessed} threads revisados</p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-white/58">
                Aún no hay ejecución manual en esta sesión.
              </p>
            )}
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-300/30 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <div className="space-y-4">
        {loading ? (
          <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-8 text-sm text-white/58">
            Cargando locales...
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-white/12 bg-white/[0.03] p-8 text-sm text-white/58">
            No hay locales con tickets todavía. Ejecuta un sync manual para traer actividad nueva.
          </div>
        ) : (
          items.map(item => (
            <Link
              key={item.id}
              href={
                item.latestTicket
                  ? `/admin/pedidos/${encodeURIComponent(item.latestTicket.groupKey)}`
                  : `/admin/clientes/${item.id}`
              }
              className="block rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,18,32,0.9),rgba(7,12,22,0.92))] p-5 transition hover:-translate-y-0.5 hover:border-cyan-300/28 hover:bg-[linear-gradient(180deg,rgba(13,24,43,0.94),rgba(7,12,22,0.98))]"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`h-3 w-3 rounded-full ${
                        item.openTicketCount > 0 ? 'bg-emerald-400' : 'bg-rose-400'
                      } shadow-[0_0_18px_currentColor]`}
                    />
                    <p className="text-lg font-semibold tracking-tight text-white">
                      {item.display_name}
                    </p>
                  </div>
                  <p className="mt-1 text-sm text-cyan-100/78">{item.phone}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/42">
                    {item.openTicketCount > 0
                      ? 'Nuevo mensaje pendiente'
                      : 'Último ticket resuelto'}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="rounded-full border border-cyan-300/22 bg-cyan-300/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100">
                    {item.ticketCount} ticket{item.ticketCount === 1 ? '' : 's'}
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/58">
                    {item.openTicketCount > 0
                      ? `${item.openTicketCount} abierto${item.openTicketCount === 1 ? '' : 's'}`
                      : 'Sin tickets abiertos'}
                  </div>
                </div>
              </div>

              <p className="mt-4 whitespace-pre-line text-sm leading-6 text-white/78">
                {clip(item.lastPreviewText ?? 'Sin mensaje reciente')}
              </p>

              <div className="mt-5 flex flex-wrap gap-5 text-xs uppercase tracking-[0.18em] text-white/45">
                <span>Último: {formatDateTime(item.lastActivityAt ?? item.updated_at)}</span>
                <span>Local: {item.razon_social ?? 'Sin razón social'}</span>
              </div>
            </Link>
          ))
        )}
      </div>
    </section>
  )
}
