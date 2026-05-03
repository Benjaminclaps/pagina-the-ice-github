const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw62iy-qF5XU2SIKTGpJkTqOWSlwwZ4q_4RlEe1fyO-MB0Zc9Yyjk21_WDFoQ4L5qkUmQ/exec'

function normalizeDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed

    const asDate = new Date(trimmed)
    if (!Number.isNaN(asDate.getTime())) {
      return asDate.toISOString().slice(0, 10)
    }
  }

  return ''
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)

  if (!body || typeof body !== 'object') {
    return Response.json({ ok: false, error: 'Body inválido' }, { status: 400 })
  }

  const upstream = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const payload = await upstream.json().catch(async () => ({ ok: upstream.ok, text: await upstream.text().catch(() => '') }))

  return Response.json(payload, { status: upstream.status })
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date') ?? ''

  const upstream = await fetch(APPS_SCRIPT_URL)
  const payload = await upstream.json().catch(async () => ({ ok: upstream.ok, text: await upstream.text().catch(() => '') }))

  if (payload && Array.isArray(payload.items)) {
    payload.items = payload.items.map((item: any) => ({
      ...item,
      entregar_el_dia: normalizeDate(item.entregar_el_dia),
    }))

    if (date) {
      payload.items = payload.items.filter((item: any) => item.entregar_el_dia === date)
    }
  }

  return Response.json(payload, { status: upstream.status })
}
