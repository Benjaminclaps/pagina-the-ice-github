import { createRequestContext } from '@/lib/ops/logger'
import { createOrderRecord, listOrders } from '@/lib/ops/service'
import { jsonError, readJson } from '@/lib/ops/http'
import { createOrderSchema } from '@/lib/ops/schemas'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { requestId } = createRequestContext(request)

  try {
    const items = await listOrders()

    return Response.json({
      ok: true,
      items,
      requestId,
    })
  } catch (error) {
    return jsonError(error, requestId)
  }
}

export async function POST(request: Request) {
  const { requestId } = createRequestContext(request)

  try {
    const body = await readJson(request, createOrderSchema)
    const payload = await createOrderRecord({
      ...body,
      requestId,
    })

    return Response.json(
      {
        ...payload,
        requestId,
      },
      { status: 201 },
    )
  } catch (error) {
    return jsonError(error, requestId)
  }
}
