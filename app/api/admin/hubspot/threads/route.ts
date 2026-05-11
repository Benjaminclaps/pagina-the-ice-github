import { createRequestContext } from '@/lib/ops/logger'
import { jsonError } from '@/lib/ops/http'
import { listNormalizedThreads } from '@/lib/ops/service'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { requestId } = createRequestContext(request)

  try {
    const { searchParams } = new URL(request.url)
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? Number(limitParam) : 10
    const items = await listNormalizedThreads(Number.isFinite(limit) ? limit : 10)

    return Response.json({
      ok: true,
      items,
      requestId,
    })
  } catch (error) {
    return jsonError(error, requestId)
  }
}
