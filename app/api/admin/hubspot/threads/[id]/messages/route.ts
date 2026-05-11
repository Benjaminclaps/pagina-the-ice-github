import { createRequestContext } from '@/lib/ops/logger'
import { jsonError } from '@/lib/ops/http'
import { getThreadMessages } from '@/lib/ops/service'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  context: RouteContext<'/api/admin/hubspot/threads/[id]/messages'>,
) {
  const { requestId } = createRequestContext(request)

  try {
    const { searchParams } = new URL(request.url)
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? Number(limitParam) : 30
    const { id } = await context.params
    const payload = await getThreadMessages(id, Number.isFinite(limit) ? limit : 30)

    return Response.json({
      ok: true,
      ...payload,
      requestId,
    })
  } catch (error) {
    return jsonError(error, requestId)
  }
}
