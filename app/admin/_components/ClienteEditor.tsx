'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type Customer = {
  id: string
  phone: string
  display_name: string
  razon_social: string | null
  hubspot_contact_id: string | null
  status: string
  updated_at: string
}

type CustomerTicket = {
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

type CustomerTicketDetail = CustomerTicket | null

export default function ClienteEditor({ customerId }: { customerId: string }) {
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [tickets, setTickets] = useState<CustomerTicket[]>([])
  const [latestTicket, setLatestTicket] = useState<CustomerTicketDetail>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    const loadCustomer = async () => {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch(`/api/admin/customers/${customerId}`, {
          cache: 'no-store',
        })
        const data = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(data?.error ?? 'No se pudo cargar el cliente')
        }

        setCustomer(data)

        const ticketsResponse = await fetch(`/api/admin/customers/${customerId}/tickets`, {
          cache: 'no-store',
        })
        const ticketsData = await ticketsResponse.json().catch(() => null)

        if (!ticketsResponse.ok) {
          throw new Error(ticketsData?.error ?? 'No se pudieron cargar los tickets')
        }

        setTickets(Array.isArray(ticketsData?.tickets) ? ticketsData.tickets : [])
        setLatestTicket(ticketsData?.latestTicket ?? null)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el cliente')
      } finally {
        setLoading(false)
      }
    }

    const timer = window.setTimeout(() => {
      void loadCustomer()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [customerId])

  const save = async () => {
    if (!customer) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(`/api/admin/customers/${customerId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: customer.phone,
          display_name: customer.display_name,
          razon_social: customer.razon_social,
          hubspot_contact_id: customer.hubspot_contact_id,
          status: customer.status,
        }),
      })
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(data?.error ?? 'No se pudo guardar el cliente')
      }

      setCustomer(data)
      setSuccess('Cliente actualizado')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar el cliente')
    } finally {
      setSaving(false)
    }
  }

  const toggleLatestTicket = async (resolved: boolean) => {
    if (!latestTicket) return

    setToggling(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(`/api/admin/messages/${encodeURIComponent(latestTicket.groupKey)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ resolved }),
      })
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(data?.error ?? 'No se pudo actualizar el ticket')
      }

      const ticketsResponse = await fetch(`/api/admin/customers/${customerId}/tickets`, {
        cache: 'no-store',
      })
      const ticketsData = await ticketsResponse.json().catch(() => null)

      if (ticketsResponse.ok) {
        setTickets(Array.isArray(ticketsData?.tickets) ? ticketsData.tickets : [])
        setLatestTicket(ticketsData?.latestTicket ?? null)
      }

      setSuccess(resolved ? 'Ticket resuelto' : 'Ticket reabierto')
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : 'No se pudo actualizar el ticket')
    } finally {
      setToggling(false)
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.28em] text-cyan-200/70">Cliente</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Editar local</h1>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-300/30 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-2xl border border-emerald-300/30 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100">
          {success}
        </div>
      ) : null}

      {loading || !customer ? (
        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-8 text-sm text-white/58">
          Cargando cliente...
        </div>
      ) : (
        <div className="max-w-3xl rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(13,28,46,0.92),rgba(8,13,24,0.96))] p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm text-white/66">Teléfono</span>
              <input
                value={customer.phone}
                onChange={event => setCustomer(current => current ? { ...current, phone: event.target.value } : current)}
                className="rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm text-white/66">Nombre local</span>
              <input
                value={customer.display_name}
                onChange={event => setCustomer(current => current ? { ...current, display_name: event.target.value } : current)}
                className="rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm text-white/66">Razón social</span>
              <input
                value={customer.razon_social ?? ''}
                onChange={event => setCustomer(current => current ? { ...current, razon_social: event.target.value } : current)}
                className="rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm text-white/66">HubSpot contact ID</span>
              <input
                value={customer.hubspot_contact_id ?? ''}
                onChange={event => setCustomer(current => current ? { ...current, hubspot_contact_id: event.target.value } : current)}
                className="rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50"
              />
            </label>

            <label className="grid gap-2 md:col-span-2">
              <span className="text-sm text-white/66">Estado</span>
              <select
                value={customer.status}
                onChange={event => setCustomer(current => current ? { ...current, status: event.target.value } : current)}
                className="rounded-2xl border border-white/12 bg-[#091321] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50"
              >
                <option value="new">new</option>
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>
            </label>
          </div>

          <button
            onClick={save}
            disabled={saving}
            className="mt-6 rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:bg-cyan-300/60"
          >
            {saving ? 'Guardando...' : 'Guardar local'}
          </button>
        </div>
      )}

      {customer && latestTicket ? (
        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-white/45">Tickets</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                Último ticket
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-white/72">
                <input
                  type="checkbox"
                  checked={latestTicket.status !== 'open'}
                  disabled={toggling}
                  onChange={event => toggleLatestTicket(event.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-white/10 text-emerald-400 focus:ring-emerald-400"
                />
                {latestTicket.status !== 'open' ? 'Resuelto' : 'Abrir ticket'}
              </label>
            </div>
          </div>

          <Link
            href={`/admin/pedidos/${encodeURIComponent(latestTicket.groupKey)}`}
            className="mt-4 block rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:border-cyan-300/30 hover:bg-black/30"
          >
            <p className="text-sm font-semibold text-white">
              {latestTicket.previewText || 'Sin mensaje'}
            </p>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/42">
              {latestTicket.messageCount} mensaje{latestTicket.messageCount === 1 ? '' : 's'} ·{' '}
              {latestTicket.status === 'open'
                ? 'abierto'
                : latestTicket.status === 'portal_loaded'
                  ? 'cargado en portal'
                  : latestTicket.status === 'ordered'
                    ? 'pedido creado'
                    : 'resuelto'}
            </p>
            <p className="mt-3 text-xs text-white/45">
              Último mensaje:{' '}
              {new Intl.DateTimeFormat('es-CL', {
                dateStyle: 'short',
                timeStyle: 'short',
              }).format(new Date(latestTicket.lastMessageAt))}
            </p>
          </Link>

          <div className="mt-5 space-y-3">
            {tickets.map(ticket => (
              <div
                key={ticket.groupKey}
                className="rounded-2xl border border-white/10 bg-black/20 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {ticket.previewText || 'Sin mensaje'}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/42">
                      {ticket.messageCount} mensaje{ticket.messageCount === 1 ? '' : 's'} ·{' '}
                      {ticket.status === 'open'
                        ? 'abierto'
                        : ticket.status === 'portal_loaded'
                          ? 'cargado en portal'
                          : ticket.status === 'ordered'
                            ? 'pedido creado'
                            : 'resuelto'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-3 w-3 rounded-full ${
                        ticket.status === 'open' ? 'bg-emerald-400' : 'bg-rose-400'
                      }`}
                    />
                    <Link
                      href={`/admin/pedidos/${encodeURIComponent(ticket.groupKey)}`}
                      className="rounded-full border border-white/12 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-white/72"
                    >
                      Abrir
                    </Link>
                  </div>
                </div>
                <p className="mt-3 text-xs text-white/45">
                  Último mensaje: {new Intl.DateTimeFormat('es-CL', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(ticket.lastMessageAt))}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}
