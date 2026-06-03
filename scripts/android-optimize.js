#!/usr/bin/env node

/**
 * Скрипт оптимизации для запуска на Android (Termux)
 * Уменьшает потребление памяти и оптимизирует производительность
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 Оптимизация для Android...\n');

// 1. Создать .env.android файл
const envAndroidContent = `# Android/Termux Configuration
NODE_ENV=production
PORT=3000
HOSTNAME=0.0.0.0

# Оптимизация памяти
NODE_OPTIONS=--max-old-space-size=512

# Отключить аналитику
NEXT_TELEMETRY_DISABLED=1

# Оптимизация базы данных
DATABASE_PATH=./data/pos_system.db
DATABASE_TIMEOUT=5000

# Логирование
LOG_LEVEL=info
`;

fs.writeFileSync(
  path.join(__dirname, '..', '.env.android'),
  envAndroidContent
);
console.log('✅ Создан файл .env.android');

// 2. Создать скрипт запуска для Android
const startAndroidScript = `#!/bin/bash

# Скрипт запуска для Android/Termux

# Установить переменные окружения
export NODE_ENV=production
export NODE_OPTIONS="--max-old-space-size=512"
export NEXT_TELEMETRY_DISABLED=1

# Убедиться, что папка data существует
mkdir -p data

# Проверить БД
echo "Проверка базы данных..."
node scripts/check-db-structure.js

# Запустить сервер
echo "Запуск Restaurant POS сервера..."
npm start
`;

fs.writeFileSync(
  path.join(__dirname, '..', 'start-android.sh'),
  startAndroidScript
);
fs.chmodSync(path.join(__dirname, '..', 'start-android.sh'), 0o755);
console.log('✅ Создан скрипт start-android.sh');

// 3. Создать скрипт для tmux
const tmuxScript = `#!/bin/bash

# Запуск сервера в tmux сессии для Android

SESSION_NAME="restaurant"

# Проверить, запущена ли сессия
if tmux has-session -t $SESSION_NAME 2>/dev/null; then
    echo "Сессия $SESSION_NAME уже запущена"
    tmux attach-session -t $SESSION_NAME
else
    echo "Создание новой сессии $SESSION_NAME..."
    tmux new-session -d -s $SESSION_NAME -c ~/restaurant-pos "bash start-android.sh"
    echo "✅ Сессия создана. Используйте 'tmux attach-session -t $SESSION_NAME' для подключения"
fi
`;

fs.writeFileSync(
  path.join(__dirname, '..', 'start-tmux.sh'),
  tmuxScript
);
fs.chmodSync(path.join(__dirname, '..', 'start-tmux.sh'), 0o755);
console.log('✅ Создан скрипт start-tmux.sh');

// 4. Создать скрипт для Termux:Boot
const bootScript = `#!/data/data/com.termux/files/usr/bin/bash

# Автоматический запуск при включении планшета

cd ~/restaurant-pos || exit 1

# Убедиться, что tmux установлен
if ! command -v tmux &> /dev/null; then
    pkg install -y tmux
fi

# Запустить сервер в tmux
tmux new-session -d -s restaurant "bash start-android.sh"

# Логирование
echo "Restaurant POS запущен в $(date)" >> ~/.termux/boot.log
`;

const bootDir = path.join(__dirname, '..', '.termux', 'boot');
if (!fs.existsSync(bootDir)) {
    fs.mkdirSync(bootDir, { recursive: true });
}

fs.writeFileSync(
  path.join(bootDir, 'start-restaurant'),
  bootScript
);
fs.chmodSync(path.join(bootDir, 'start-restaurant'), 0o755);
console.log('✅ Создан скрипт для Termux:Boot');

// 5. Обновить package.json с новыми скриптами
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

packageJson.scripts = {
  ...packageJson.scripts,
  'android:start': 'bash start-android.sh',
  'android:tmux': 'bash start-tmux.sh',
  'android:optimize': 'node scripts/android-optimize.js',
  'android:check-network': 'ifconfig || ip addr show',
};

fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
console.log('✅ Обновлены скрипты в package.json');

console.log('\n✨ Оптимизация завершена!\n');
console.log('Команды для запуска:');
console.log('  npm run android:start    - Запустить сервер');
console.log('  npm run android:tmux     - Запустить в tmux');
console.log('  npm run android:check-network - Проверить IP адрес\n');
