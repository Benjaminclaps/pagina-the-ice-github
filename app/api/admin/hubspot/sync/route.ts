import { createRequestContext } from '@/lib/ops/logger'
import { jsonError, readJson } from '@/lib/ops/http'
import { syncHubSpotToSupabase } from '@/lib/ops/service'
import { syncBodySchema } from '@/lib/ops/schemas'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const { requestId } = createRequestContext(request)

  try {
    const contentLength = request.headers.get('content-length')
    const body =
      contentLength && Number(contentLength) > 0
        ? await readJson(request, syncBodySchema)
        : {}

    const payload = await syncHubSpotToSupabase({
      ...body,
      requestId,
    })

    return Response.json({
      ...payload,
      requestId,
    })
  } catch (error) {
    return jsonError(error, requestId)
  }
}
