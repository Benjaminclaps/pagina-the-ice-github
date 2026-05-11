'use client'

import { useEffect, useState } from 'react'

type OrderItem = {
  id: string
  delivery_date: string
  status: string
  approved_by: string | null
  notes: string | null
  created_at: string
  original_text: string | null
  original_message: string
  source_thread_id: string
  customer_name: string
  source: string
  customer: {
    display_name: string
    phone: string
    razon_social: string | null
  } | null
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

export default function HistorialBoard() {
  const [items, setItems] = useState<OrderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch('/api/admin/orders', {
          cache: 'no-store',
        })
        const data = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(data?.error ?? 'No se pudo cargar historial')
        }

        setItems(Array.isArray(data?.items) ? data.items : [])
      } catch (loadError) {
        setItems([])
        setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar historial')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  return (
    <section className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.28em] text-cyan-200/70">Historial</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Pedidos aprobados</h1>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-300/30 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <div className="space-y-4">
        {loading ? (
          <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-8 text-sm text-white/58">
            Cargando historial...
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-white/12 bg-white/[0.03] p-8 text-sm text-white/58">
            Todavía no hay pedidos aprobados.
          </div>
        ) : (
          items.map(item => (
            <div
              key={item.id}
              className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,18,32,0.9),rgba(7,12,22,0.92))] p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold tracking-tight text-white">
                    {item.customer?.display_name ?? item.customer_name ?? 'Cliente sin resolver'}
                  </p>
                  <p className="mt-1 text-sm text-cyan-100/74">
                    {item.customer?.phone ?? 'Sin teléfono'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/12 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/55">
                    {item.status}
                  </span>
                  <span className="rounded-full border border-cyan-300/22 bg-cyan-300/12 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-cyan-100">
                    {item.source}
                  </span>
                </div>
              </div>

              <div className="mt-4 grid gap-3 text-sm text-white/70 md:grid-cols-3">
                <p>Entrega: {item.delivery_date}</p>
                <p>Aprobó: {item.approved_by ?? 'Sin dato'}</p>
                <p>Creado: {formatDateTime(item.created_at)}</p>
              </div>

              <p className="mt-4 whitespace-pre-line text-sm leading-6 text-white/78">
                {item.original_text ?? item.original_message}
              </p>

              <div className="mt-4 grid gap-2 text-xs uppercase tracking-[0.16em] text-white/38 md:grid-cols-3">
                <p>Thread {item.source_thread_id}</p>
                <p>Persistido en Supabase</p>
                <p>{item.customer?.razon_social ?? 'Sin razón social'}</p>
              </div>

              {item.notes ? <p className="mt-4 text-sm text-white/58">Notas: {item.notes}</p> : null}
            </div>
          ))
        )}
      </div>
    </section>
  )
}
