import { createRequestContext } from '@/lib/ops/logger'
import { createCustomerRecord, listCustomers } from '@/lib/ops/service'
import { readJson, jsonError } from '@/lib/ops/http'
import { customerCreateSchema } from '@/lib/ops/schemas'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { requestId } = createRequestContext(request)

  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') ?? undefined
    const items = await listCustomers(search)

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
    const body = await readJson(request, customerCreateSchema)
    const customer = await createCustomerRecord(body)

    return Response.json(
      {
        ok: true,
        ...customer,
        requestId,
      },
      { status: 201 },
    )
  } catch (error) {
    return jsonError(error, requestId)
  }
}
