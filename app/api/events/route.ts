// Server-Sent Events endpoint для real-time синхронізації між пристроями
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { createSseResponse } from '@/lib/sse'

export async function GET(request: Request) {
  return createSseResponse(request)
}
