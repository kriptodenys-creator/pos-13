// IndexedDB для хранения больших объемов данных
const DB_NAME = 'pos_system_db'
const DB_VERSION = 1
const ORDERS_STORE = 'orders'
const MENU_STORE = 'menu'

type IndexedDbOrder = {
  id: string | number
  timestamp?: string | number | Date
  [key: string]: unknown
}

type IndexedDbMenuItem = {
  id: string | number
  category?: string
  [key: string]: unknown
}

let db: IDBDatabase | null = null

export async function initIndexedDB(): Promise<IDBDatabase> {
  if (db) return db

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      db = request.result
      resolve(db)
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      // Создаем хранилище для заказов
      if (!db.objectStoreNames.contains(ORDERS_STORE)) {
        const ordersStore = db.createObjectStore(ORDERS_STORE, { keyPath: 'id' })
        ordersStore.createIndex('timestamp', 'timestamp', { unique: false })
        ordersStore.createIndex('status', 'status', { unique: false })
      }

      // Создаем хранилище для меню
      if (!db.objectStoreNames.contains(MENU_STORE)) {
        const menuStore = db.createObjectStore(MENU_STORE, { keyPath: 'id' })
        menuStore.createIndex('category', 'category', { unique: false })
      }
    }
  })
}

// Сохранение заказов
export async function saveOrdersToIndexedDB(orders: IndexedDbOrder[]): Promise<void> {
  const database = await initIndexedDB()
  const transaction = database.transaction([ORDERS_STORE], 'readwrite')
  const store = transaction.objectStore(ORDERS_STORE)

  for (const order of orders) {
    store.put(order)
  }

  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
}

// Получение заказов
export async function getOrdersFromIndexedDB(from?: Date, to?: Date): Promise<IndexedDbOrder[]> {
  const database = await initIndexedDB()
  const transaction = database.transaction([ORDERS_STORE], 'readonly')
  const store = transaction.objectStore(ORDERS_STORE)
  const index = store.index('timestamp')

  return new Promise((resolve, reject) => {
    const request = index.getAll()
    
    request.onsuccess = () => {
      let orders = request.result as IndexedDbOrder[]
      
      // Фильтруем по датам если указаны
      if (from || to) {
        orders = orders.filter(order => {
          const ts = order.timestamp
          const orderDate = ts instanceof Date ? ts : new Date(ts ?? 0)
          if (from && orderDate < from) return false
          if (to && orderDate > to) return false
          return true
        })
      }
      
      resolve(orders)
    }
    
    request.onerror = () => reject(request.error)
  })
}

// Сохранение меню
export async function saveMenuToIndexedDB(menuItems: IndexedDbMenuItem[]): Promise<void> {
  const database = await initIndexedDB()
  const transaction = database.transaction([MENU_STORE], 'readwrite')
  const store = transaction.objectStore(MENU_STORE)

  // Очищаем старые данные
  store.clear()

  for (const item of menuItems) {
    store.put(item)
  }

  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
}

// Получение меню
export async function getMenuFromIndexedDB(): Promise<IndexedDbMenuItem[]> {
  const database = await initIndexedDB()
  const transaction = database.transaction([MENU_STORE], 'readonly')
  const store = transaction.objectStore(MENU_STORE)

  return new Promise((resolve, reject) => {
    const request = store.getAll()
    request.onsuccess = () => resolve(request.result as IndexedDbMenuItem[])
    request.onerror = () => reject(request.error)
  })
}

// Очистка старых данных (старше 7 дней)
export async function cleanupOldOrders(): Promise<void> {
  const database = await initIndexedDB()
  const transaction = database.transaction([ORDERS_STORE], 'readwrite')
  const store = transaction.objectStore(ORDERS_STORE)
  const index = store.index('timestamp')

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  return new Promise((resolve, reject) => {
    const request = index.openCursor()
    
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result
      if (cursor) {
        const order = cursor.value
        if (new Date(order.timestamp) < sevenDaysAgo) {
          cursor.delete()
        }
        cursor.continue()
      } else {
        resolve()
      }
    }
    
    request.onerror = () => reject(request.error)
  })
}
