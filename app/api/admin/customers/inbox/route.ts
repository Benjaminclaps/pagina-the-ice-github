import { createRequestContext } from '@/lib/ops/logger'
import { jsonError } from '@/lib/ops/http'
import { listCustomerInboxSummaries } from '@/lib/ops/service'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { requestId } = createRequestContext(request)

  try {
    const { searchParams } = new URL(request.url)
    const limit = Number(searchParams.get('limit') ?? 80)
    const items = await listCustomerInboxSummaries(Number.isFinite(limit) ? limit : 80)

    return Response.json({
      ok: true,
      items,
      requestId,
    })
  } catch (error) {
    return jsonError(error, requestId)
  }
}
