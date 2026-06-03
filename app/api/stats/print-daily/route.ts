import { getDatabase } from '@/lib/database'
import { printDailyStatsNow } from '@/lib/dailyStatsPrinter'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const raw = await request.text()
    let markAsPrinted = false
    if (raw && raw.trim()) {
      try {
        const data = JSON.parse(raw)
        markAsPrinted = data?.markAsPrinted === true
      } catch {
        // ignore invalid JSON; default is false
      }
    }

    const db = getDatabase()
    await printDailyStatsNow(db as any, markAsPrinted)

    return Response.json({ success: true, markAsPrinted })
  } catch (e: any) {
    console.error('[API /stats/print-daily] error:', e)
    return Response.json(
      { success: false, error: e?.message || String(e), stack: e?.stack || undefined },
      { status: 500 }
    )
  }
}
