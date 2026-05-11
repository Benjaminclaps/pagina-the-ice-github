import { createRequestContext } from '@/lib/ops/logger'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { requestId } = createRequestContext(request)

  return Response.json({
    ok: true,
    service: 'the-ice-mvp',
    now: new Date().toISOString(),
    requestId,
  })
}
