import { getDatabase } from "@/lib/database"

export async function POST(request: Request) {
  try {
    const db = getDatabase()

    if (!db) {
      return new Response(JSON.stringify({ success: false, error: 'Database not available' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Получаем дату начала текущего дня
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayISO = today.toISOString()

    console.log('[API] Cleanup: Удаляем все заказы до', todayISO)

    // Удаляем заказы, созданные до текущего дня - ПОЛНОСТЬЮ И НЕОБРАТИМО
    const tx = db.transaction(() => {
      let totalDeleted = 0

      // Сначала удаляем модификаторы заказов
      try {
        const deleteModifiers = db.prepare(`
          DELETE FROM order_item_modifiers 
          WHERE order_item_id IN (
            SELECT oi.id FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            WHERE o.created_at < ?
          )
        `)
        const modifiersDeleted = deleteModifiers.run(todayISO)
        console.log('[API] Cleanup: Удалено модификаторов заказов:', modifiersDeleted.changes)
        totalDeleted += modifiersDeleted.changes
      } catch (e) {
        console.log('[API] Cleanup: Таблица order_item_modifiers может быть пуста')
      }

      // Затем удаляем позиции заказов
      try {
        const deleteItems = db.prepare(`
          DELETE FROM order_items 
          WHERE order_id IN (
            SELECT id FROM orders WHERE created_at < ?
          )
        `)
        const itemsDeleted = deleteItems.run(todayISO)
        console.log('[API] Cleanup: Удалено позиций заказов:', itemsDeleted.changes)
        totalDeleted += itemsDeleted.changes
      } catch (e) {
        console.log('[API] Cleanup: Таблица order_items может быть пуста')
      }

      // Наконец удаляем сами заказы
      try {
        const deleteOrders = db.prepare(`
          DELETE FROM orders WHERE created_at < ?
        `)
        const ordersDeleted = deleteOrders.run(todayISO)
        console.log('[API] Cleanup: Удалено заказов:', ordersDeleted.changes)
        totalDeleted += ordersDeleted.changes
      } catch (e) {
        console.log('[API] Cleanup: Таблица orders может быть пуста')
      }

      // Оптимизируем БД для полного удаления данных
      try {
        db.exec('VACUUM')
        console.log('[API] Cleanup: БД оптимизирована (VACUUM)')
      } catch (e) {
        console.log('[API] Cleanup: VACUUM не удался')
      }

      return totalDeleted
    })

    const totalDeleted = tx()

    console.log('[API] Cleanup: Всего удалено записей:', totalDeleted)

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Old orders permanently deleted',
      totalDeleted: totalDeleted
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[API] Error in cleanup route:', error)
    return new Response(JSON.stringify({ success: false, error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
