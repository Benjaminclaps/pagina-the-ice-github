type Account = 'primary' | 'secondary'

type AccountConfig = {
  apiToken?: string
  scenarioId?: string
  baseUrl?: string
}

const ACCOUNT_CONFIG: Record<Account, AccountConfig> = {
  primary: {
    apiToken: process.env.MAKE_API_TOKEN_PRIMARY,
    scenarioId: process.env.MAKE_SCENARIO_ID_PRIMARY,
    baseUrl: process.env.MAKE_API_BASE_URL_PRIMARY,
  },
  secondary: {
    apiToken: process.env.MAKE_API_TOKEN_SECONDARY,
    scenarioId: process.env.MAKE_SCENARIO_ID_SECONDARY,
    baseUrl: process.env.MAKE_API_BASE_URL_SECONDARY,
  },
}

function isAccount(value: unknown): value is Account {
  return value === 'primary' || value === 'secondary'
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, '')
}

function extractExecutionId(payload: unknown) {
  if (!payload || typeof payload !== 'object') return null

  const record = payload as Record<string, unknown>
  const candidates = [
    record.executionId,
    record.execution_id,
    record.id,
    record.runId,
    record.run_id,
  ]

  for (const candidate of candidates) {
    if (typeof candidate === 'string' || typeof candidate === 'number') {
      return String(candidate)
    }
  }

  return null
}

function readErrorMessage(payload: unknown) {
  if (!payload) return ''

  if (typeof payload === 'string') return payload

  if (typeof payload === 'object') {
    const record = payload as Record<string, unknown>
    const message = record.message ?? record.error ?? record.detail ?? record.details

    if (typeof message === 'string') return message
    if (typeof message === 'number' || typeof message === 'boolean') return String(message)

    try {
      return JSON.stringify(payload)
    } catch {
      return ''
    }
  }

  return String(payload)
}

function missingFields(config: AccountConfig) {
  const missing: string[] = []
  if (!config.apiToken) missing.push('MAKE_API_TOKEN')
  if (!config.scenarioId) missing.push('MAKE_SCENARIO_ID')
  if (!config.baseUrl) missing.push('MAKE_API_BASE_URL')
  return missing
}

export async function POST(request: Request) {
  let body: { account?: unknown } = {}

  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Body JSON inválido' }, { status: 400 })
  }

  if (!isAccount(body.account)) {
    return Response.json(
      { error: 'account debe ser "primary" o "secondary"' },
      { status: 400 },
    )
  }

  const config = ACCOUNT_CONFIG[body.account]
  const missing = missingFields(config)

  if (missing.length > 0) {
    return Response.json(
      {
        error: `Faltan variables de entorno para ${body.account}: ${missing.join(', ')}`,
      },
      { status: 500 },
    )
  }

  const baseUrl = normalizeBaseUrl(config.baseUrl!)
  const scenarioId = config.scenarioId!

  try {
    const upstream = await fetch(`${baseUrl}/scenarios/${scenarioId}/run`, {
      method: 'POST',
      headers: {
        Authorization: `Token ${config.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        responsive: false,
      }),
    })

    const contentType = upstream.headers.get('content-type') ?? ''
    const responsePayload = contentType.includes('application/json')
      ? await upstream.json().catch(() => null)
      : await upstream.text().catch(() => '')

    if (!upstream.ok) {
      const errorMessage =
        readErrorMessage(responsePayload) ||
        `Make respondió ${upstream.status}`

      return Response.json(
        {
          error: errorMessage,
        },
        { status: upstream.status },
      )
    }

    return Response.json(
      {
        ok: true,
        message: 'Escenario Make disparado correctamente',
        executionId: extractExecutionId(responsePayload),
      },
      { status: 200 },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado al disparar Make'
    return Response.json({ error: message }, { status: 502 })
  }
}
