import { createRequestContext } from '@/lib/ops/logger'
import { jsonError } from '@/lib/ops/http'
import { listPendingMessageGroups } from '@/lib/ops/service'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { requestId } = createRequestContext(request)

  try {
    const items = await listPendingMessageGroups()

    return Response.json({
      ok: true,
      items,
      requestId,
    })
  } catch (error) {
    return jsonError(error, requestId)
  }
}
