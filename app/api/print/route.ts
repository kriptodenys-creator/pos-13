import { getDatabase } from '@/lib/database'
import { getPrinterConfig, printToUSB, type PrintOrderData, transliterateCyrillicToLatin } from '@/lib/printer'

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { orderId?: string | number }
    const orderId = body.orderId

    if (!orderId) {
      return Response.json({ success: false, error: 'Missing orderId' }, { status: 400 })
    }

    const config = getPrinterConfig()
    if (!config.name) {
      return Response.json({ success: false, error: 'PRINTER_NAME is not set' }, { status: 500 })
    }

    const db = getDatabase()

    const orderRow = db
      .prepare(
        `
        SELECT
          o.id,
          o.daily_number,
          o.order_type,
          o.phone_number,
          o.customer_name,
          o.table_number,
          o.created_at,
          o.total
        FROM orders o
        WHERE o.id = ?
      `
      )
      .get(String(orderId)) as any

    if (!orderRow) {
      return Response.json({ success: false, error: 'Order not found' }, { status: 404 })
    }

    const itemRows = db
      .prepare(
        `
        SELECT
          oi.id as order_item_id,
          oi.quantity,
          mi.name_uk as item_name_uk,
          mi.name_lt as item_name_lt,
          m.name_uk as mod_name_uk,
          m.name_lt as mod_name_lt
        FROM order_items oi
        LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
        LEFT JOIN order_item_modifiers oim ON oim.order_item_id = oi.id
        LEFT JOIN modifiers m ON m.id = oim.modifier_id
        WHERE oi.order_id = ?
        ORDER BY oi.id ASC
      `
      )
      .all(String(orderId)) as any[]

    const itemsMap = new Map<string, { name: string; quantity: number; modifiers: string[] }>()
    for (const r of itemRows) {
      const key = String(r.order_item_id)
      if (!itemsMap.has(key)) {
        const itemName = r.item_name_uk || r.item_name_lt || 'Без названия'
        itemsMap.set(key, {
          name: String(itemName),
          quantity: Number(r.quantity) || 1,
          modifiers: [],
        })
      }

      const modName = r.mod_name_lt || transliterateCyrillicToLatin(r.mod_name_uk || '')
      if (modName) {
        itemsMap.get(key)!.modifiers.push(String(modName))
      }
    }

    const order: PrintOrderData = {
      id: orderRow.id,
      dailyNumber: orderRow.daily_number ?? null,
      orderType: orderRow.order_type || undefined,
      phone_number: orderRow.phone_number || undefined,
      customer_name: orderRow.customer_name || undefined,
      table_number: orderRow.table_number || undefined,
      timestamp: orderRow.created_at || undefined,
      total: orderRow.total || undefined,
      items: Array.from(itemsMap.values()),
    }

    console.log('[API /print] Order data:', { 
      id: order.id, 
      orderType: order.orderType, 
      phone_number: order.phone_number,
      customer_name: order.customer_name 
    })

    const envDebug = {
      PRINTER_NAME: process.env.PRINTER_NAME,
      PRINTER_FORCE_LATIN: process.env.PRINTER_FORCE_LATIN,
      PRINTER_ENCODING: process.env.PRINTER_ENCODING,
      PRINTER_ESC_T: process.env.PRINTER_ESC_T,
      PRINTER_USE_HTML: process.env.PRINTER_USE_HTML,
      NODE_ENV: process.env.NODE_ENV,
    }
    console.log('[API /print] Printer env:', envDebug)

    const res = await printToUSB(order)
    console.log('[API /print] Print result:', { method: res.method, errors: res.errors })
    return Response.json({ success: true, method: res.method, errors: res.errors || undefined, env: envDebug })
  } catch (e: any) {
    console.error('[API /print] Print error:', e)
    return Response.json(
      { success: false, error: e?.message || String(e), stack: e?.stack || undefined },
      { status: 500 }
    )
  }
}
