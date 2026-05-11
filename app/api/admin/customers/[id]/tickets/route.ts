import { createRequestContext } from '@/lib/ops/logger'
import { jsonError } from '@/lib/ops/http'
import { getCustomerTicketSummaries } from '@/lib/ops/service'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, context: RouteContext<'/api/admin/customers/[id]/tickets'>) {
  const { requestId } = createRequestContext(request)

  try {
    const { id } = await context.params
    const payload = await getCustomerTicketSummaries(id)

    return Response.json({
      ok: true,
      ...payload,
      requestId,
    })
  } catch (error) {
    return jsonError(error, requestId)
  }
}
