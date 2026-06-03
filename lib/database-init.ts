import { initializeDatabase } from "./database"

let isInitialized = false

export async function ensureDatabaseInitialized() {
  if (!isInitialized) {
    try {
      initializeDatabase()
      isInitialized = true
      console.log("[v0] База данных успешно инициализирована")
    } catch (error) {
      console.error("[v0] Ошибка инициализации базы данных:", error)
      throw error
    }
  }
}

// Автоматическая инициализация при импорте модуля
if (typeof window === "undefined") {
  // Только на сервере
  ensureDatabaseInitialized().catch(console.error)
}
