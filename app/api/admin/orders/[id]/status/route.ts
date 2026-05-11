import { createRequestContext } from '@/lib/ops/logger'
import { updateOrderStatus } from '@/lib/ops/service'
import { jsonError, readJson } from '@/lib/ops/http'
import { updateOrderStatusSchema } from '@/lib/ops/schemas'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: Request,
  context: RouteContext<'/api/admin/orders/[id]/status'>,
) {
  const { requestId } = createRequestContext(request)

  try {
    const body = await readJson(request, updateOrderStatusSchema)
    const { id } = await context.params
    const order = await updateOrderStatus(id, body.status)

    return Response.json({
      ok: true,
      ...order,
      requestId,
    })
  } catch (error) {
    return jsonError(error, requestId)
  }
}
