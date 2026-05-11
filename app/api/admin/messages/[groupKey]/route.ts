import { createRequestContext } from '@/lib/ops/logger'
import { jsonError } from '@/lib/ops/http'
import { getPendingMessageGroup, reopenMessageGroup, resolveMessageGroup } from '@/lib/ops/service'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const resolveSchema = z.object({
  resolved: z.boolean(),
})

export async function GET(request: Request, context: RouteContext<'/api/admin/messages/[groupKey]'>) {
  const { requestId } = createRequestContext(request)

  try {
    const { groupKey } = await context.params
    const payload = await getPendingMessageGroup(decodeURIComponent(groupKey))

    if (!payload) {
      return Response.json(
        {
          ok: false,
          error: 'Grupo no encontrado',
          requestId,
        },
        { status: 404 },
      )
    }

    return Response.json({
      ok: true,
      ...payload,
      requestId,
    })
  } catch (error) {
    return jsonError(error, requestId)
  }
}

export async function PATCH(request: Request, context: RouteContext<'/api/admin/messages/[groupKey]'>) {
  const { requestId } = createRequestContext(request)

  try {
    const { groupKey } = await context.params
    const body = resolveSchema.parse(await request.json().catch(() => ({})))

    const payload = body.resolved
      ? await resolveMessageGroup(decodeURIComponent(groupKey))
      : await reopenMessageGroup(decodeURIComponent(groupKey))

    return Response.json({
      ok: true,
      groupKey: payload.groupKey,
      updatedMessages: payload.updatedMessages,
      requestId,
    })
  } catch (error) {
    return jsonError(error, requestId)
  }
}
