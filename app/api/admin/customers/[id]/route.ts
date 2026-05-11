import { createRequestContext } from '@/lib/ops/logger'
import { getCustomerById, updateCustomerRecord } from '@/lib/ops/service'
import { readJson, jsonError } from '@/lib/ops/http'
import { customerUpdateSchema } from '@/lib/ops/schemas'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, context: RouteContext<'/api/admin/customers/[id]'>) {
  const { requestId } = createRequestContext(request)

  try {
    const { id } = await context.params
    const customer = await getCustomerById(id)

    return Response.json({
      ok: true,
      ...customer,
      requestId,
    })
  } catch (error) {
    return jsonError(error, requestId)
  }
}

export async function PATCH(request: Request, context: RouteContext<'/api/admin/customers/[id]'>) {
  const { requestId } = createRequestContext(request)

  try {
    const body = await readJson(request, customerUpdateSchema)
    const { id } = await context.params
    const customer = await updateCustomerRecord(id, body)

    return Response.json({
      ok: true,
      ...customer,
      requestId,
    })
  } catch (error) {
    return jsonError(error, requestId)
  }
}
