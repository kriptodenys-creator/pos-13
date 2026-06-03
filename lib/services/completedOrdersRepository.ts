import { fetchWithRetry } from '@/lib/fetchWithRetry'
import type { CompletedOrder } from '@/types/pos'

type LogFn = (message?: unknown, ...optionalParams: unknown[]) => void

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function getString(obj: Record<string, unknown> | null, key: string): string | undefined {
  const v = obj?.[key]
  return typeof v === 'string' ? v : undefined
}

export async function loadCompletedOrdersFromDatabase(params?: {
  logError?: LogFn
}): Promise<CompletedOrder[]> {
  const logError = params?.logError ?? console.error

  try {
    if (typeof window === 'undefined') {
      return []
    }

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)

    const todayStartISO = todayStart.toISOString()
    const tomorrowStartISO = tomorrowStart.toISOString()

    const response = await fetchWithRetry(`/api/orders?from=${todayStartISO}&to=${tomorrowStartISO}`, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      },
    })

    if (!response || !response.ok) {
      const status = response?.status || 'unknown'
      const statusText = response?.statusText || 'unknown'
      logError('[POS] Ошибка загрузки истории:', status, statusText)

      if (response) {
        try {
          const errorText = await response.text()
          logError('[POS] Детали ошибки API:', errorText)
        } catch (e) {
          logError('[POS] Не удалось получить детали ошибки:', e)
        }
      }

      try {
        const cached = localStorage.getItem('completedOrders')
        if (cached) {
          return JSON.parse(cached)
        }
      } catch (e) {
        logError('[POS] Ошибка загрузки из localStorage:', e)
      }

      return []
    }

    const data = await response.json()

    const dataObj = asRecord(data)
    const ordersRaw = dataObj?.orders

    const rawArray = Array.isArray(ordersRaw) ? ordersRaw : []

    const sortedOrders = rawArray.sort((a, b) => {
      const ar = asRecord(a)
      const br = asRecord(b)
      const aTs = getString(ar, 'created_at') ?? getString(ar, 'timestamp') ?? ''
      const bTs = getString(br, 'created_at') ?? getString(br, 'timestamp') ?? ''
      return new Date(bTs).getTime() - new Date(aTs).getTime()
    })

    const orders: CompletedOrder[] = sortedOrders.map((order: unknown) => {
      const o = asRecord(order)
      const itemsRaw = o?.items
      const itemsArr = Array.isArray(itemsRaw) ? itemsRaw : []
      return {
        id: String(o?.id ?? ''),
        daily_number: o?.daily_number != null ? String(o.daily_number) : undefined,
        business_date: o?.business_date != null ? String(o.business_date) : undefined,
        items: itemsArr.map((item: unknown) => {
          const it = asRecord(item)
          const modsRaw = it?.modifiers
          const modsArr = Array.isArray(modsRaw) ? modsRaw : []

          const baseName = getString(it, 'name')
          const nameUk = getString(it, 'name_uk') ?? baseName ?? 'Без названия'
          const nameLt = getString(it, 'name_lt') ?? baseName ?? 'Be pavadinimo'

          return {
            id: String(it?.id ?? ''),
            name: { uk: nameUk, lt: nameLt },
            quantity: Number(it?.quantity ?? 1),
            price: Number(it?.price ?? 0),
            category: String(it?.category ?? ''),
            comment: String(it?.comment ?? ''),
            selectedModifiers: modsArr.map((mod: unknown) => {
              const m = asRecord(mod)
              const modName = asRecord(m?.name)
              const groupName = asRecord(m?.groupName)

              const mBaseName = getString(m, 'name')
              const mUk = getString(m, 'name_uk') ?? getString(modName, 'uk') ?? mBaseName ?? 'Без названия'
              const mLt = getString(m, 'name_lt') ?? getString(modName, 'lt') ?? mBaseName ?? 'Be pavadinimo'

              const gUk = getString(m, 'group_name') ?? getString(groupName, 'uk') ?? ''
              const gLt = getString(m, 'group_name') ?? getString(groupName, 'lt') ?? ''

              const id = m?.id ?? ''

              return {
                id: String(id),
                name: { uk: mUk, lt: mLt },
                price: Number(m?.price ?? 0),
                type: String(m?.type ?? 'addon'),
                groupName: { uk: gUk, lt: gLt },
                groupId: String((m?.groupId ?? id) as unknown),
              }
            }),
          }
        }),
        total: Number(o?.total ?? 0),
        orderType: String(o?.order_type ?? o?.orderType ?? 'В заведении'),
        timestamp: new Date(String(o?.timestamp ?? o?.created_at ?? '')),
        customer_name: String(o?.customer_name ?? ''),
        phone_number: String(o?.phone_number ?? ''),
        table_number: String(o?.table_number ?? ''),
        preorder_time: (o?.preorder_time != null ? String(o.preorder_time) : undefined),
        status: String(o?.status ?? 'completed'),
        is_preorder: Boolean(o?.is_preorder ?? false),
        employee_discount_percent: (o?.employee_discount_percent != null ? Number(o.employee_discount_percent) : null),
        employee_discount_amount: (o?.employee_discount_amount != null ? Number(o.employee_discount_amount) : null),
      }
    })

    try {
      localStorage.setItem('completedOrders', JSON.stringify(orders))
    } catch (e) {
      logError('[POS] Ошибка сохранения в localStorage:', e)
    }

    return orders
  } catch (error) {
    logError('[POS] Ошибка при загрузке истории заказов:', error)

    try {
      const cached = localStorage.getItem('completedOrders')
      if (cached) {
        return JSON.parse(cached)
      }
    } catch (e) {
      logError('[POS] Ошибка загрузки из localStorage:', e)
    }

    return []
  }
}
