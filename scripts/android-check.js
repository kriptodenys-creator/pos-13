#!/usr/bin/env node

/**
 * Скрипт проверки готовности Android/Termux окружения
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 Проверка Android/Termux окружения...\n');

let allGood = true;

// Проверка 1: Node.js
try {
  const nodeVersion = execSync('node --version').toString().trim();
  console.log(`✅ Node.js: ${nodeVersion}`);
} catch (e) {
  console.log('❌ Node.js не установлен');
  allGood = false;
}

// Проверка 2: npm
try {
  const npmVersion = execSync('npm --version').toString().trim();
  console.log(`✅ npm: ${npmVersion}`);
} catch (e) {
  console.log('❌ npm не установлен');
  allGood = false;
}

// Проверка 3: Папка node_modules
if (fs.existsSync(path.join(__dirname, '..', 'node_modules'))) {
  console.log('✅ Зависимости установлены');
} else {
  console.log('⚠️  Зависимости не установлены. Выполните: npm install');
  allGood = false;
}

// Проверка 4: Папка data
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('✅ Создана папка data');
} else {
  console.log('✅ Папка data существует');
}

// Проверка 5: База данных
const dbPath = path.join(dataDir, 'pos_system.db');
if (fs.existsSync(dbPath)) {
  const stats = fs.statSync(dbPath);
  console.log(`✅ База данных существует (${(stats.size / 1024).toFixed(2)} KB)`);
} else {
  console.log('⚠️  База данных не найдена. Она будет создана при первом запуске');
}

// Проверка 6: .env файл
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  console.log('✅ .env.local существует');
} else {
  console.log('⚠️  .env.local не найден. Используются значения по умолчанию');
}

// Проверка 7: Память
try {
  const memInfo = execSync('free -h 2>/dev/null || vm_stat').toString();
  console.log('✅ Информация о памяти доступна');
} catch (e) {
  console.log('⚠️  Не удалось получить информацию о памяти');
}

// Проверка 8: Интернет
try {
  execSync('ping -c 1 8.8.8.8 2>/dev/null', { timeout: 3000 });
  console.log('✅ Интернет подключен');
} catch (e) {
  console.log('⚠️  Интернет не доступен (может потребоваться для npm install)');
}

// Проверка 9: Порт 3000
try {
  execSync('netstat -tuln 2>/dev/null | grep 3000 || ss -tuln 2>/dev/null | grep 3000', { stdio: 'pipe' });
  console.log('⚠️  Порт 3000 может быть занят');
} catch (e) {
  console.log('✅ Порт 3000 свободен');
}

console.log('\n' + '='.repeat(50));

if (allGood) {
  console.log('✨ Система готова к запуску!');
  console.log('\nДля запуска используйте:');
  console.log('  npm run dev:network     (режим разработки)');
  console.log('  npm start               (режим продакшена)');
  console.log('  npm run android:start   (оптимизированный запуск)');
} else {
  console.log('⚠️  Требуется дополнительная настройка');
  console.log('\nВыполните:');
  console.log('  npm install');
  console.log('  npm run android:optimize');
}

console.log('='.repeat(50) + '\n');

// Информация о сети
console.log('📡 Информация о сети:');
try {
  const ifconfig = execSync('ifconfig 2>/dev/null || ip addr show').toString();
  const lines = ifconfig.split('\n');
  let inInterface = false;
  
  for (const line of lines) {
    if (line.includes('inet ') && !line.includes('127.0.0.1')) {
      const match = line.match(/inet\s+(\d+\.\d+\.\d+\.\d+)/);
      if (match) {
        console.log(`  🌐 IP адрес: ${match[1]}`);
        console.log(`  📱 Доступ с других устройств: http://${match[1]}:3000`);
      }
    }
  }
} catch (e) {
  console.log('  ⚠️  Не удалось получить IP адрес');
}

console.log('\n✅ Проверка завершена!\n');
