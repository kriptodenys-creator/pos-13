import { promises as fs } from "fs"
import path from "path"

const DATA_DIR = path.join(process.cwd(), "data")

// Убеждаемся что папка data существует
async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR)
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true })
  }
}

// Чтение JSON файла
export async function readJsonFile<T = unknown>(filename: string): Promise<T> {
  try {
    await ensureDataDir()
    const filePath = path.join(DATA_DIR, filename)
    const data = await fs.readFile(filePath, "utf-8")
    return JSON.parse(data) as T
  } catch {
    console.log(`[v0] Файл ${filename} не найден, возвращаем пустой массив`)
    return [] as unknown as T
  }
}

// Запись JSON файла
export async function writeJsonFile(filename: string, data: unknown): Promise<boolean> {
  try {
    await ensureDataDir()
    const filePath = path.join(DATA_DIR, filename)
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8")
    console.log(`[v0] Данные сохранены в ${filename}`)
    return true
  } catch (error) {
    console.error(`[v0] Ошибка записи в ${filename}:`, error)
    return false
  }
}

// Специфичные функции для заказов
export async function getOrdersFromFile() {
  return await readJsonFile<unknown[]>("orders.json")
}

export async function saveOrdersToFile(orders: unknown[]): Promise<boolean> {
  return await writeJsonFile("orders.json", orders)
}

// Специфичные функции для меню
export async function getMenuFromFile() {
  return await readJsonFile<unknown[]>("menu.json")
}

export async function saveMenuToFile(menu: unknown[]): Promise<boolean> {
  return await writeJsonFile("menu.json", menu)
}

// Специфичные функции для завершенных заказов
export async function getCompletedOrdersFromFile() {
  return await readJsonFile<unknown[]>("completed-orders.json")
}

export async function saveCompletedOrdersToFile(orders: unknown[]): Promise<boolean> {
  return await writeJsonFile("completed-orders.json", orders)
}

// Функции для работы с изображениями
const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads")

async function ensureUploadsDir() {
  try {
    await fs.access(UPLOADS_DIR)
  } catch {
    await fs.mkdir(UPLOADS_DIR, { recursive: true })
  }
}

export async function saveImageFile(buffer: Buffer, filename: string): Promise<string> {
  try {
    await ensureUploadsDir()
    const timestamp = Date.now()
    const ext = path.extname(filename)
    const name = path.basename(filename, ext)
    const newFilename = `${name}_${timestamp}${ext}`
    const filePath = path.join(UPLOADS_DIR, newFilename)
    
    await fs.writeFile(filePath, buffer)
    console.log(`[v0] Изображение сохранено: ${newFilename}`)
    
    // Возвращаем относительный путь для использования в веб-приложении
    return `/uploads/${newFilename}`
  } catch (error) {
    console.error(`[v0] Ошибка сохранения изображения:`, error)
    throw error
  }
}
