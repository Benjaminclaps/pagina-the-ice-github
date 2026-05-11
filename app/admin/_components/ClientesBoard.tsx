'use client'

import Link from 'next/link'
import { useDeferredValue, useEffect, useState } from 'react'

type Customer = {
  id: string
  phone: string
  display_name: string
  razon_social: string | null
  status: string
  updated_at: string
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

export default function ClientesBoard() {
  const [items, setItems] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    phone: '',
    display_name: '',
    razon_social: '',
  })
  const [saving, setSaving] = useState(false)
  const deferredSearch = useDeferredValue(search)

  const loadCustomers = async (term?: string) => {
    setLoading(true)
    setError(null)

    try {
      const query = term ? `?search=${encodeURIComponent(term)}` : ''
      const response = await fetch(`/api/admin/customers${query}`, {
        cache: 'no-store',
      })
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(data?.error ?? 'No se pudo cargar clientes')
      }

      setItems(Array.isArray(data?.items) ? data.items : [])
    } catch (loadError) {
      setItems([])
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar clientes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCustomers(deferredSearch)
    }, 0)

    return () => window.clearTimeout(timer)
  }, [deferredSearch])

  const createCustomer = async () => {
    setSaving(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...form,
          razon_social: form.razon_social || null,
        }),
      })
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(data?.error ?? 'No se pudo crear el cliente')
      }

      setForm({
        phone: '',
        display_name: '',
        razon_social: '',
      })

      loadCustomers(deferredSearch)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo crear el cliente')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[0.7fr_1.3fr]">
        <div className="rounded-[28px] border border-cyan-300/18 bg-[linear-gradient(180deg,rgba(13,28,46,0.92),rgba(8,13,24,0.96))] p-6">
          <p className="text-[11px] uppercase tracking-[0.28em] text-cyan-200/70">Alta rápida</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white">Nuevo local</h1>

          <div className="mt-5 grid gap-4">
            <input
              value={form.phone}
              onChange={event => setForm(current => ({ ...current, phone: event.target.value }))}
              placeholder="+569..."
              className="rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50"
            />
            <input
              value={form.display_name}
              onChange={event =>
                setForm(current => ({ ...current, display_name: event.target.value }))
              }
              placeholder="Nombre local"
              className="rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50"
            />
            <input
              value={form.razon_social}
              onChange={event =>
                setForm(current => ({ ...current, razon_social: event.target.value }))
              }
              placeholder="Razón social"
              className="rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50"
            />
            <button
              onClick={createCustomer}
              disabled={saving}
              className="rounded-2xl bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-wait disabled:bg-cyan-300/60"
            >
              {saving ? 'Guardando...' : 'Crear local'}
            </button>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-white/45">Directorio</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                Locales conocidos
              </h2>
            </div>

            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Buscar por nombre o teléfono"
              className="min-w-[240px] rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/50"
            />
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-rose-300/30 bg-rose-300/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          ) : null}

          <div className="mt-5 space-y-3">
            {loading ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-6 text-sm text-white/58">
                Cargando clientes...
              </div>
            ) : items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.03] px-4 py-6 text-sm text-white/58">
                No hay locales que coincidan con la búsqueda.
              </div>
            ) : (
              items.map(item => (
                <Link
                  key={item.id}
                  href={`/admin/clientes/${item.id}`}
                  className="block rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-4 transition hover:border-cyan-300/24 hover:bg-white/[0.08]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{item.display_name}</p>
                      <p className="mt-1 text-sm text-cyan-100/74">{item.phone}</p>
                    </div>
                    <span className="rounded-full border border-white/12 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/55">
                      {item.status}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-white/56">{item.razon_social ?? 'Sin razón social'}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.16em] text-white/38">
                    Actualizado {formatDateTime(item.updated_at)}
                  </p>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
