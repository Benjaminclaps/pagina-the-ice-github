'use client'

import { useRouter } from 'next/navigation'
import { startTransition, useEffect, useState } from 'react'

type GroupDetail = {
  groupKey: string
  threadId: string
  groupedText: string
  receivedAt: string
  resolved: boolean
  customer: {
    id: string
    phone: string
    display_name: string
    razon_social: string | null
    status: string
  } | null
  items: Array<{
    id: string
    messageId: string
    text: string
    receivedAt: string
    direction: string
    status: string
  }>
}

type ThreadMessages = {
  threadId: string
  items: Array<{
    messageId: string
    createdAt: string
    direction: string | null
    text: string
    sender: string | null
    senderPhone: string | null
    actorId: string | null
    senderType: string
  }>
}

function localDate(offsetDays = 0) {
  const base = new Date()
  base.setDate(base.getDate() + offsetDays)
  const offset = base.getTimezoneOffset() * 60000
  return new Date(base.getTime() - offset).toISOString().slice(0, 10)
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

export default function PedidoDetail({ groupKey }: { groupKey: string }) {
  const router = useRouter()
  const [group, setGroup] = useState<GroupDetail | null>(null)
  const [thread, setThread] = useState<ThreadMessages | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    id: '',
    phone: '',
    display_name: '',
    razon_social: '',
    status: 'new',
  })
  const [deliveryDate, setDeliveryDate] = useState(localDate(0))
  const [approvedBy, setApprovedBy] = useState('Benjamin')
  const [notes, setNotes] = useState('')
  const [resolving, setResolving] = useState(false)
  const [showLocal, setShowLocal] = useState(true)
  const [savingCustomer, setSavingCustomer] = useState(false)
  const [savingOrder, setSavingOrder] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      setSuccess(null)

      try {
        const groupResponse = await fetch(`/api/admin/messages/${encodeURIComponent(groupKey)}`, {
          cache: 'no-store',
        })
        const groupData = await groupResponse.json().catch(() => null)

        if (!groupResponse.ok) {
          throw new Error(groupData?.error ?? 'No se pudo cargar el grupo')
        }

        setGroup(groupData)

        const customer = groupData?.customer
        setForm({
          id: customer?.id ?? '',
          phone: customer?.phone ?? '',
          display_name: customer?.display_name ?? '',
          razon_social: customer?.razon_social ?? '',
          status: customer?.status ?? 'new',
        })
        setNotes(groupData?.groupedText ?? '')

        const threadResponse = await fetch(
          `/api/admin/hubspot/threads/${groupData.threadId}/messages?limit=20`,
          {
            cache: 'no-store',
          },
        )
        const threadData = await threadResponse.json().catch(() => null)

        if (!threadResponse.ok) {
          throw new Error(threadData?.error ?? 'No se pudo cargar el thread')
        }

        setThread(threadData)

        if (!customer) {
          const inferredPhone =
            threadData?.items?.find((item: ThreadMessages['items'][number]) => item.senderPhone)
              ?.senderPhone ?? ''

          if (inferredPhone) {
            setForm(current => (current.phone ? current : { ...current, phone: inferredPhone }))
          }
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el detalle')
      } finally {
        setLoading(false)
      }
    }

    const timer = window.setTimeout(() => {
      void load()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [groupKey])

  const saveCustomer = async () => {
    setSavingCustomer(true)
    setError(null)
    setSuccess(null)

    try {
      const payload = {
        phone: form.phone,
        display_name: form.display_name,
        razon_social: form.razon_social || null,
        status: form.status,
      }

      const response = await fetch(
        form.id ? `/api/admin/customers/${form.id}` : '/api/admin/customers',
        {
          method: form.id ? 'PATCH' : 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
      )
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(data?.error ?? 'No se pudo guardar el cliente')
      }

      setForm({
        id: data.id,
        phone: data.phone,
        display_name: data.display_name,
        razon_social: data.razon_social ?? '',
        status: data.status,
      })

      setGroup(current =>
        current
          ? {
              ...current,
              customer: {
                id: data.id,
                phone: data.phone,
                display_name: data.display_name,
                razon_social: data.razon_social ?? null,
                status: data.status,
              },
            }
          : current,
      )

      setSuccess('Cliente guardado')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar el cliente')
    } finally {
      setSavingCustomer(false)
    }
  }

  const createOrder = async () => {
    if (!form.id) {
      setError('Primero guarda o vincula un cliente')
      return
    }

    setSavingOrder(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/admin/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId: form.id,
          sourceGroupKey: groupKey,
          deliveryDate,
          approvedBy,
          notes: notes || null,
        }),
      })
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(data?.error ?? 'No se pudo crear el pedido')
      }

      setSuccess(
        data?.hubspotComment?.status === 'created'
          ? data?.storage?.status === 'dry_run'
            ? 'Pedido guardado. Dry-run activo y comentario agregado en HubSpot.'
            : 'Pedido guardado en Supabase y comentario agregado en HubSpot.'
          : data?.hubspotComment?.status === 'failed'
            ? data?.storage?.status === 'dry_run'
              ? 'Pedido guardado. Dry-run activo, pero no se pudo dejar comentario en HubSpot.'
              : 'Pedido guardado en Supabase, pero no se pudo dejar comentario en HubSpot.'
            : data?.storage?.status === 'dry_run'
              ? 'Pedido guardado. Dry-run activo.'
              : 'Pedido guardado en Supabase.',
      )

      await fetch(`/api/admin/messages/${encodeURIComponent(groupKey)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ resolved: true }),
      }).catch(() => null)

      startTransition(() => {
        router.push('/admin/historial')
      })
    } catch (orderError) {
      setError(orderError instanceof Error ? orderError.message : 'No se pudo crear el pedido')
    } finally {
      setSavingOrder(false)
    }
  }

  const toggleGroupResolution = async (resolved: boolean) => {
    setResolving(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(`/api/admin/messages/${encodeURIComponent(groupKey)}`, {
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

      setGroup(current => (current ? { ...current, resolved } : current))
      setSuccess(resolved ? 'Ticket marcado como resuelto' : 'Ticket reabierto')
    } catch (resolveError) {
      setError(resolveError instanceof Error ? resolveError.message : 'No se pudo actualizar el ticket')
    } finally {
      setResolving(false)
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-cyan-200/70">Detalle</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Grupo operativo</h1>
          <p className="mt-2 text-sm text-white/58">Thread {group?.threadId ?? 'cargando...'}</p>
        </div>
        <button
          onClick={() => {
            navigator.clipboard.writeText(group?.threadId ?? '')
            setSuccess('Thread copiado al portapapeles')
          }}
          className="rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white/78 transition hover:bg-white/[0.08]"
        >
          Copiar threadId
        </button>
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

      {loading || !group ? (
        <div className="rounded-[28px] border border-white/10 bg-white/[0.05] p-8 text-sm text-white/58">
          Cargando detalle del grupo...
        </div>
      ) : (
      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            <div className="rounded-[28px] border border-cyan-300/18 bg-[linear-gradient(180deg,rgba(13,28,46,0.92),rgba(8,13,24,0.96))] p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-[0.25em] text-cyan-200/70">Mensaje agrupado</p>
                <p className="text-xs uppercase tracking-[0.18em] text-white/40">
                  Recibido {formatDateTime(group.receivedAt)}
                </p>
              </div>
              <label className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-white/72">
                <input
                  type="checkbox"
                  checked={group.resolved}
                  onChange={event => {
                    void toggleGroupResolution(event.target.checked)
                  }}
                  disabled={resolving}
                  className="h-4 w-4 rounded border-white/20 bg-white/10 text-emerald-400 focus:ring-emerald-400"
                />
                {resolving
                  ? group.resolved
                    ? 'Reabriendo...'
                    : 'Marcando resuelto...'
                  : group.resolved
                    ? 'Resuelto'
                    : 'Marcar ticket resuelto'}
              </label>
              <p className="mt-4 whitespace-pre-line text-sm leading-7 text-white/82">
                {group.groupedText}
              </p>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
              <p className="text-xs uppercase tracking-[0.25em] text-white/45">Mensajes del thread</p>
              <div className="mt-5 space-y-3">
                {thread?.items.map(item => (
                  <div
                    key={item.messageId}
                    className={`rounded-2xl border px-4 py-3 ${
                      item.direction === 'INCOMING'
                        ? 'border-cyan-300/20 bg-cyan-300/10'
                        : 'border-white/10 bg-white/[0.05]'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs uppercase tracking-[0.18em] text-white/42">
                      <span>{item.direction === 'INCOMING' ? 'Cliente' : 'Operación'}</span>
                      <span>{formatDateTime(item.createdAt)}</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-white/82">{item.text}</p>
                    <p className="mt-2 text-xs text-white/45">
                      {item.sender ?? item.actorId ?? 'Sin emisor'} {item.senderPhone ? `· ${item.senderPhone}` : ''}
                    </p>
                    {group.resolved && item.direction === 'INCOMING' ? (
                      <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-emerald-100">
                        <input
                          type="checkbox"
                          checked
                          disabled
                          className="h-4 w-4 rounded border-emerald-300/40 bg-emerald-400/20 text-emerald-400"
                        />
                        Resuelto
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
              <button
                type="button"
                onClick={() => setShowLocal(current => !current)}
                className="flex w-full items-center justify-between gap-3 text-left"
              >
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-white/45">Local</p>
                  <h2 className="mt-2 text-xl font-semibold tracking-tight text-white">
                    {form.display_name || 'Sin nombre'}
                  </h2>
                </div>
                <span className="rounded-full border border-white/12 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/55">
                  {showLocal ? 'Cerrar' : 'Abrir'}
                </span>
              </button>

              {showLocal ? (
                <div className="mt-4">
                  <p className="text-xs leading-5 text-white/52">
                    Si no existe el contacto, créalo aquí con el nombre del local y su teléfono. Queda
                    guardado para siempre en Supabase.
                  </p>

                  <div className="mt-5 grid gap-4">
                    <label className="grid gap-2">
                      <span className="text-sm text-white/66">Teléfono</span>
                      <input
                        value={form.phone}
                        onChange={event => setForm(current => ({ ...current, phone: event.target.value }))}
                        className="rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50"
                      />
                    </label>

                    <label className="grid gap-2">
                      <span className="text-sm text-white/66">Nombre local</span>
                      <input
                        value={form.display_name}
                        onChange={event =>
                          setForm(current => ({ ...current, display_name: event.target.value }))
                        }
                        className="rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50"
                      />
                    </label>

                    <label className="grid gap-2">
                      <span className="text-sm text-white/66">Razón social</span>
                      <input
                        value={form.razon_social}
                        onChange={event =>
                          setForm(current => ({ ...current, razon_social: event.target.value }))
                        }
                        className="rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50"
                      />
                    </label>

                    <label className="grid gap-2">
                      <span className="text-sm text-white/66">Estado</span>
                      <select
                        value={form.status}
                        onChange={event =>
                          setForm(current => ({ ...current, status: event.target.value }))
                        }
                        className="rounded-2xl border border-white/12 bg-[#091321] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50"
                      >
                        <option value="new">new</option>
                        <option value="active">active</option>
                        <option value="inactive">inactive</option>
                      </select>
                    </label>

                    <button
                      onClick={saveCustomer}
                      disabled={savingCustomer}
                      className="rounded-2xl border border-cyan-300/22 bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:bg-cyan-300/60"
                    >
                      {savingCustomer
                        ? 'Guardando contacto...'
                        : form.id
                          ? 'Actualizar contacto'
                          : 'Crear contacto'}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
              <p className="text-xs uppercase tracking-[0.25em] text-white/45">Agendar pedido</p>
              <p className="mt-3 text-xs leading-5 text-white/52">
                Las notas arrancan con el mensaje del ticket para que no tengas que copiar nada a
                mano.
              </p>

              <div className="mt-5 grid gap-4">
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => setDeliveryDate(localDate(0))}
                    className="rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-3 text-sm font-semibold text-white/78 transition hover:bg-white/[0.09]"
                  >
                    Hoy
                  </button>
                  <button
                    onClick={() => setDeliveryDate(localDate(1))}
                    className="rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-3 text-sm font-semibold text-white/78 transition hover:bg-white/[0.09]"
                  >
                    Mañana
                  </button>
                </div>

                <label className="grid gap-2">
                  <span className="text-sm text-white/66">Fecha de entrega</span>
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={event => setDeliveryDate(event.target.value)}
                    className="rounded-2xl border border-white/12 bg-[#091321] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm text-white/66">Aprobado por</span>
                  <input
                    value={approvedBy}
                    onChange={event => setApprovedBy(event.target.value)}
                    className="rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50"
                  />
                </label>

                <label className="grid gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-white/66">Notas</span>
                    <button
                      type="button"
                      onClick={() => setNotes(group.groupedText)}
                      className="text-[11px] uppercase tracking-[0.18em] text-cyan-300 transition hover:text-cyan-200"
                    >
                      Usar mensaje del ticket
                    </button>
                  </div>
                  <textarea
                    value={notes}
                    onChange={event => setNotes(event.target.value)}
                    rows={4}
                    className="rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50"
                  />
                </label>

                <button
                  onClick={createOrder}
                  disabled={savingOrder}
                  className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 disabled:cursor-wait disabled:bg-white/60"
                >
                  {savingOrder ? 'Guardando pedido...' : 'Agendar pedido'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
