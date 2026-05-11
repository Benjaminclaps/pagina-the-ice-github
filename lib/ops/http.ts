import 'server-only'

import { ZodSchema } from 'zod'

import { HubSpotApiError } from './hubspot'
import { logger } from './logger'

export async function readJson<T>(request: Request, schema: ZodSchema<T>) {
  const body = await request.json().catch(() => null)
  return schema.parse(body)
}

export function jsonError(error: unknown, requestId?: string) {
  if (error instanceof HubSpotApiError) {
    logger.error('route.error.hubspot', {
      requestId,
      status: error.status,
      payload: error.payload,
      error,
    })

    return Response.json(
      {
        ok: false,
        error: error.message,
        details: error.payload,
        requestId,
      },
      { status: error.status },
    )
  }

  if (error instanceof Error) {
    logger.error('route.error', {
      requestId,
      error,
    })

    return Response.json(
      {
        ok: false,
        error: error.message,
        requestId,
      },
      { status: 400 },
    )
  }

  logger.error('route.error.unknown', {
    requestId,
    error,
  })

  return Response.json(
    {
      ok: false,
      error: 'Error inesperado',
      requestId,
    },
    { status: 500 },
  )
}
