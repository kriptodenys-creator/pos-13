import { addSystemLog, clearSystemLogs, getSystemLogs } from '@/lib/systemLogs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const limitParam = searchParams.get('limit')
  const limit = limitParam ? Number(limitParam) : 200

  return Response.json({
    success: true,
    logs: getSystemLogs(Number.isFinite(limit) ? limit : 200),
  })
}

export async function DELETE() {
  clearSystemLogs()
  return Response.json({ success: true })
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  if (!rawBody || rawBody.trim().length === 0) {
    return Response.json({ success: false, error: 'Empty request body' }, { status: 400 })
  }

  let data: any
  try {
    data = JSON.parse(rawBody)
  } catch {
    return Response.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const level = (data.level ?? 'error') as 'error' | 'warn' | 'info'
  const message = typeof data.message === 'string' ? data.message : 'Unknown error'

  addSystemLog({
    level,
    message,
    stack: typeof data.stack === 'string' ? data.stack : undefined,
    context: data.context,
  })

  return Response.json({ success: true })
}
