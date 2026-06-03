import { Database } from 'better-sqlite3'

let migrationsRun = false

export function runMigrations(db: Database) {
  if (migrationsRun) {
    console.log('[Migrations] Already run, skipping...')
    return
  }

  console.log('[Migrations] Starting database migrations...')

  try {
    // Міграція 1: Додавання поля comment в order_items
    try {
      db.exec(`ALTER TABLE order_items ADD COLUMN comment TEXT DEFAULT ''`)
      console.log('[Migrations] ✅ Added comment column to order_items')
    } catch {
      // Колонка вже існує
    }

    // Міграція 2: Додавання колонок для знижок співробітників в orders
    try {
      db.exec(`ALTER TABLE orders ADD COLUMN employee_discount_id INTEGER`)
      console.log('[Migrations] ✅ Added employee_discount_id to orders')
    } catch {
      // Колонка вже існує
    }

    try {
      db.exec(`ALTER TABLE orders ADD COLUMN employee_discount_name TEXT`)
      console.log('[Migrations] ✅ Added employee_discount_name to orders')
    } catch {
      // Колонка вже існує
    }

    try {
      db.exec(`ALTER TABLE orders ADD COLUMN employee_discount_percent INTEGER`)
      console.log('[Migrations] ✅ Added employee_discount_percent to orders')
    } catch {
      // Колонка вже існує
    }

    try {
      db.exec(`ALTER TABLE orders ADD COLUMN employee_discount_amount REAL`)
      console.log('[Migrations] ✅ Added employee_discount_amount to orders')
    } catch {
      // Колонка вже існує
    }

    // Міграція 3: Додавання поля is_fryer в menu_items для пометки позицій для фритюра
    try {
      db.exec(`ALTER TABLE menu_items ADD COLUMN is_fryer INTEGER DEFAULT 0`)
      console.log('[Migrations] ✅ Added is_fryer column to menu_items')
    } catch {
      // Колонка вже існує
    }

    // Міграція 4: Додавання поля status в order_items якщо відсутнє
    try {
      const cols = db.prepare('PRAGMA table_info(order_items)').all() as any[]
      const hasStatus = cols.some((c: any) => String(c.name) === 'status')
      if (!hasStatus) {
        db.exec(`ALTER TABLE order_items ADD COLUMN status TEXT DEFAULT 'pending'`)
        console.log('[Migrations] ✅ Added status column to order_items')
      }
    } catch (e) {
      console.warn('[Migrations] order_items status migration warning:', e)
    }

    // Міграція 4b: Додавання поля cooking_time в menu_items для часу приготування у фритюрі
    try {
      db.exec(`ALTER TABLE menu_items ADD COLUMN cooking_time INTEGER DEFAULT 180`)
      console.log('[Migrations] ✅ Added cooking_time column to menu_items')
    } catch {
      // Колонка вже існує
    }

    // Міграція 3: Додавання колонок для щасливих годин в order_items
    try {
      db.exec(`ALTER TABLE order_items ADD COLUMN original_price REAL`)
      console.log('[Migrations] ✅ Added original_price to order_items')
    } catch {
      // Колонка вже існує
    }

    try {
      db.exec(`ALTER TABLE order_items ADD COLUMN happy_hour_discount INTEGER DEFAULT 0`)
      console.log('[Migrations] ✅ Added happy_hour_discount to order_items')
    } catch {
      // Колонка вже існує
    }

    // Міграція 4: Додавання поля updated_at в orders
    try {
      db.exec(`ALTER TABLE orders ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`)
      console.log('[Migrations] ✅ Added updated_at to orders')
    } catch {
      // Колонка вже існує
    }

    // Міграція 5: Додавання поля cancelled_at в orders
    try {
      db.exec(`ALTER TABLE orders ADD COLUMN cancelled_at DATETIME`)
      console.log('[Migrations] ✅ Added cancelled_at to orders')
    } catch {
      // Колонка вже існує
    }

    // Міграція 5b: Щоденна нумерація замовлень
    try {
      db.exec(`ALTER TABLE orders ADD COLUMN business_date TEXT`)
      console.log('[Migrations] ✅ Added business_date to orders')
    } catch {
      // Колонка вже існує
    }

    try {
      db.exec(`ALTER TABLE orders ADD COLUMN daily_number INTEGER`)
      console.log('[Migrations] ✅ Added daily_number to orders')
    } catch {
      // Колонка вже існує
    }


    // Міграція 5c: Комбо-набори (слоты + варианты) + сохранение выбора в заказе
    try {
      db.exec(`ALTER TABLE order_items ADD COLUMN combo_data TEXT`)
      console.log('[Migrations] ✅ Added combo_data to order_items')
    } catch {
      // Колонка вже існує
    }

    try {
      db.exec(`ALTER TABLE combo_sets ADD COLUMN price_override REAL`)
      console.log('[Migrations] ✅ Added price_override to combo_sets')
    } catch {
      // Колонка вже існує або таблиця ще не створена
    }

    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS combo_sets (
          id TEXT PRIMARY KEY,
          menu_item_id TEXT NOT NULL UNIQUE,
          is_active INTEGER DEFAULT 1,
          price_override REAL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (menu_item_id) REFERENCES menu_items (id) ON DELETE CASCADE
        )
      `)
      console.log('[Migrations] ✅ Created combo_sets table')
    } catch (e) {
      console.error('[Migrations] Error creating combo_sets:', e)
    }

    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS combo_slots (
          id TEXT PRIMARY KEY,
          combo_set_id TEXT NOT NULL,
          title_lt TEXT NOT NULL,
          title_uk TEXT NOT NULL,
          slot_type TEXT NOT NULL, -- 'modifier' | 'menu_item_choice'
          required INTEGER DEFAULT 1,
          min_selection INTEGER DEFAULT 1,
          max_selection INTEGER DEFAULT 1,
          sort_order INTEGER DEFAULT 0,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (combo_set_id) REFERENCES combo_sets (id) ON DELETE CASCADE
        )
      `)
      console.log('[Migrations] ✅ Created combo_slots table')
    } catch (e) {
      console.error('[Migrations] Error creating combo_slots:', e)
    }

    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS combo_slot_items (
          id TEXT PRIMARY KEY,
          combo_slot_id TEXT NOT NULL,
          menu_item_id TEXT NOT NULL,
          price_delta REAL DEFAULT 0,
          is_available INTEGER DEFAULT 1,
          sort_order INTEGER DEFAULT 0,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (combo_slot_id) REFERENCES combo_slots (id) ON DELETE CASCADE,
          FOREIGN KEY (menu_item_id) REFERENCES menu_items (id) ON DELETE CASCADE
        )
      `)
      console.log('[Migrations] ✅ Created combo_slot_items table')
    } catch (e) {
      console.error('[Migrations] Error creating combo_slot_items:', e)
    }

    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS combo_slot_modifiers (
          id TEXT PRIMARY KEY,
          combo_slot_id TEXT NOT NULL,
          modifier_id TEXT NOT NULL,
          required INTEGER DEFAULT 1,
          min_selection INTEGER DEFAULT 1,
          max_selection INTEGER DEFAULT 1,
          sort_order INTEGER DEFAULT 0,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (combo_slot_id) REFERENCES combo_slots (id) ON DELETE CASCADE,
          FOREIGN KEY (modifier_id) REFERENCES modifiers (id) ON DELETE CASCADE
        )
      `)
      console.log('[Migrations] ✅ Created combo_slot_modifiers table')
    } catch (e) {
      console.error('[Migrations] Error creating combo_slot_modifiers:', e)
    }

    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS combo_slot_item_modifiers (
          id TEXT PRIMARY KEY,
          combo_slot_item_id TEXT NOT NULL,
          modifier_id TEXT NOT NULL,
          required INTEGER DEFAULT 0,
          min_selection INTEGER DEFAULT 0,
          max_selection INTEGER DEFAULT 1,
          sort_order INTEGER DEFAULT 0,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (combo_slot_item_id) REFERENCES combo_slot_items (id) ON DELETE CASCADE,
          FOREIGN KEY (modifier_id) REFERENCES modifiers (id) ON DELETE CASCADE
        )
      `)
      console.log('[Migrations] ✅ Created combo_slot_item_modifiers table')
    } catch (e) {
      console.error('[Migrations] Error creating combo_slot_item_modifiers:', e)
    }

    // Міграція 6: Створення таблиці admin_settings
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS admin_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `)
      console.log('[Migrations] ✅ Created admin_settings table')
    } catch (e) {
      console.error('[Migrations] Error creating admin_settings:', e)
    }

    // Міграція 7: Створення таблиці pin_logs
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS pin_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          action TEXT NOT NULL,
          pin_used TEXT NOT NULL,
          success INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `)
      console.log('[Migrations] ✅ Created pin_logs table')
    } catch (e) {
      console.error('[Migrations] Error creating pin_logs:', e)
    }

    // Міграція 8: Створення таблиць інвентарю
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS inventory_items (
          id TEXT PRIMARY KEY,
          name_uk TEXT NOT NULL,
          name_lt TEXT NOT NULL,
          current_stock REAL NOT NULL DEFAULT 0,
          min_stock REAL NOT NULL DEFAULT 0,
          unit TEXT NOT NULL DEFAULT 'шт',
          cost_per_unit REAL NOT NULL DEFAULT 0,
          category_id TEXT DEFAULT 'other',
          image_url TEXT,
          unit_weight REAL DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `)
      console.log('[Migrations] ✅ Created inventory_items table')
    } catch (e) {
      console.error('[Migrations] Error creating inventory_items:', e)
    }

    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS inventory_movements (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          inventory_item_id TEXT NOT NULL,
          movement_type TEXT NOT NULL CHECK (movement_type IN ('in', 'out')),
          quantity REAL NOT NULL,
          reason TEXT,
          reference_id TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id)
        )
      `)
      console.log('[Migrations] ✅ Created inventory_movements table')
    } catch (e) {
      console.error('[Migrations] Error creating inventory_movements:', e)
    }

    // Міграція 10: Додавання полів для фритюра в combo_slot_items
    try {
      db.exec(`ALTER TABLE combo_slot_items ADD COLUMN is_fryer INTEGER DEFAULT 0`)
      console.log('[Migrations] ✅ Added is_fryer to combo_slot_items')
    } catch {
      // Колонка вже існує
    }

    try {
      db.exec(`ALTER TABLE combo_slot_items ADD COLUMN cooking_time INTEGER DEFAULT 180`)
      console.log('[Migrations] ✅ Added cooking_time to combo_slot_items')
    } catch {
      // Колонка вже існує
    }

    // Міграція 11: Зміна типу daily_number на TEXT для підтримки трьохзначних номерів
    try {
      // SQLite не підтримує ALTER COLUMN, тому створюємо нову колонку
      db.exec(`ALTER TABLE orders ADD COLUMN daily_number_new TEXT`)
      console.log('[Migrations] ✅ Added daily_number_new column')
      
      // Копіюємо дані з форматуванням
      db.prepare(`
        UPDATE orders 
        SET daily_number_new = printf('%03d', daily_number)
        WHERE daily_number IS NOT NULL
      `).run()
      console.log('[Migrations] ✅ Copied daily_number data with padding')
      
      // Видаляємо стару колонку
      db.exec(`ALTER TABLE orders DROP COLUMN daily_number`)
      console.log('[Migrations] ✅ Dropped old daily_number column')
      
      // Перейменовуємо нову колонку
      db.exec(`ALTER TABLE orders RENAME COLUMN daily_number_new TO daily_number`)
      console.log('[Migrations] ✅ Renamed daily_number_new to daily_number')
    } catch (e) {
      // Міграція вже виконана або колонка вже TEXT
      console.log('[Migrations] daily_number migration skipped or already done')
    }

    // Міграція 9: Додавання індексів для швидкодії
    console.log('[Migrations] Creating indexes...')
    
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at)',
      'CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)',
      'CREATE INDEX IF NOT EXISTS idx_orders_business_date_daily_number ON orders(business_date, daily_number)',
      'CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id)',
      'CREATE INDEX IF NOT EXISTS idx_order_items_menu_item_id ON order_items(menu_item_id)',
      'CREATE INDEX IF NOT EXISTS idx_order_item_modifiers_order_item_id ON order_item_modifiers(order_item_id)',
      'CREATE INDEX IF NOT EXISTS idx_order_item_modifiers_modifier_id ON order_item_modifiers(modifier_id)',
      'CREATE INDEX IF NOT EXISTS idx_combo_sets_menu_item_id ON combo_sets(menu_item_id)',
      'CREATE INDEX IF NOT EXISTS idx_combo_slots_combo_set_id ON combo_slots(combo_set_id)',
      'CREATE INDEX IF NOT EXISTS idx_combo_slot_items_slot_id ON combo_slot_items(combo_slot_id)',
      'CREATE INDEX IF NOT EXISTS idx_combo_slot_modifiers_slot_id ON combo_slot_modifiers(combo_slot_id)',
      'CREATE INDEX IF NOT EXISTS idx_inventory_movements_reference_id ON inventory_movements(reference_id)',
      'CREATE INDEX IF NOT EXISTS idx_inventory_movements_item_id ON inventory_movements(inventory_item_id)',
      'CREATE INDEX IF NOT EXISTS idx_inventory_movements_type ON inventory_movements(movement_type)',
      'CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category)',
      'CREATE INDEX IF NOT EXISTS idx_recipes_menu_item_id ON recipes(menu_item_id)',
      'CREATE INDEX IF NOT EXISTS idx_recipes_inventory_item_id ON recipes(inventory_item_id)'
    ]

    indexes.forEach((indexSql, i) => {
      try {
        db.exec(indexSql)
        console.log(`[Migrations] ✅ Created index ${i + 1}/${indexes.length}`)
      } catch {
        // Індекс вже існує
      }
    })

    migrationsRun = true
    console.log('[Migrations] ✅ All migrations completed successfully')
  } catch (error) {
    console.error('[Migrations] ❌ Error running migrations:', error)
    throw error
  }
}

// Функція для скидання прапорця міграцій (для тестування)
export function resetMigrations() {
  migrationsRun = false
}
