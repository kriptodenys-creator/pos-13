# 🖥️ Налаштування серверного відтворення музики на новому ПК

## Проблема

Після перенесення на інший ПК музика відтворюється на планшеті (в браузері), а не на ПК (сервері).

## Швидке рішення

### Крок 1: Перевірка файлів

Переконайтеся, що скопійовано всі файли:

```
pos12/
├── app/
│   └── api/
│       └── music/
│           └── play/
│               └── route.ts          ← API для серверного відтворення
├── components/
│   └── MusicPlayer.tsx               ← Компонент плеєра
├── public/
│   └── music/
│       ├── 001.mp3                   ← Музичні файли
│       ├── 002.mp3
│       └── ...
└── package.json
```

**ВАЖЛИВО:** Папка `public/music/` з MP3 файлами має бути скопійована!

### Крок 2: Діагностика

Запустіть діагностичний скрипт:

```bash
check-server-music.bat
```

Цей скрипт перевірить:
- ✅ PowerShell працює
- ✅ Папка з музикою існує
- ✅ MP3 файли присутні
- ✅ Відтворення працює (3 сек тест)

### Крок 3: Перевірка налаштувань

Відкрийте `app/page.tsx` і знайдіть компонент MusicPlayer (біля рядка 2156):

```typescript
<MusicPlayer 
  playlist={musicPlaylist} 
  autoplay={false}
  defaultVolume={0.3}
  playlists={availablePlaylists}
  currentPlaylistId={currentPlaylistId}
  onPlaylistChange={handlePlaylistChange}
  serverPlayback={true}  ← МАЄ БУТИ true!
/>
```

**Якщо `serverPlayback={false}` або відсутній** → музика грає в браузері!

### Крок 4: Запуск сервера

```bash
npm install
npm run dev
```

### Крок 5: Тестування

1. Відкрийте http://localhost:3000
2. Натисніть Play в музичному плеєрі
3. Відкрийте консоль браузера (F12)

**Правильні логи (музика на ПК):**
```
[Server Music] Starting playback: /music/001.mp3
[Server Music] ✓ Playing on server: C:\Users\...\pos12\public\music\001.mp3
```

**Неправильні логи (музика в браузері):**
```
Play error: ...
(немає логів [Server Music])
```

## Детальна діагностика

### Проблема 1: Музика грає в браузері

**Причина:** `serverPlayback={false}` або API не працює

**Рішення:**

1. Перевірте `app/page.tsx`:
   ```typescript
   serverPlayback={true}  // МАЄ БУТИ true
   ```

2. Перезапустіть сервер:
   ```bash
   npm run dev
   ```

3. Очистіть кеш браузера (Ctrl+Shift+R)

### Проблема 2: Помилка "File not found"

**Причина:** Папка `public/music/` не скопійована або порожня

**Рішення:**

1. Створіть папку:
   ```bash
   mkdir public\music
   ```

2. Скопіюйте MP3 файли зі старого ПК:
   ```
   Старий ПК: C:\...\pos12\public\music\*.mp3
   →
   Новий ПК: C:\...\pos12\public\music\*.mp3
   ```

3. Перевірте:
   ```bash
   dir public\music\*.mp3
   ```

### Проблема 3: Помилка "Failed to fetch"

**Причина:** Сервер не запущено або API endpoint відсутній

**Рішення:**

1. Перевірте, чи запущено сервер:
   ```bash
   npm run dev
   ```

2. Перевірте наявність файлу:
   ```
   app/api/music/play/route.ts
   ```

3. Якщо файл відсутній - скопіюйте зі старого ПК

### Проблема 4: PowerShell помилка

**Причина:** PowerShell заблокований або немає прав

**Рішення:**

1. Запустіть PowerShell як адміністратор:
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

2. Тест:
   ```powershell
   Add-Type -AssemblyName presentationCore
   $player = New-Object System.Windows.Media.MediaPlayer
   Write-Host "PowerShell OK"
   ```

### Проблема 5: Немає звуку

**Причина:** Аудіо пристрій не налаштовано

**Рішення:**

1. Перевірте гучність Windows (не на нулі)
2. Перевірте, чи підключені колонки/навушники до ПК
3. Перевірте пристрій відтворення за замовчуванням:
   - Правий клік на іконку звуку → Параметри звуку
   - Виберіть правильний пристрій виводу

## Швидкий тест

### Тест 1: PowerShell відтворення

```bash
test-music.bat
```

Має відтворитися 3 секунди музики на ПК.

### Тест 2: API endpoint

Відкрийте консоль браузера (F12) та виконайте:

```javascript
fetch('/api/music/play', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'play',
    trackUrl: '/music/001.mp3'  // Замініть на ваш файл
  })
})
.then(r => r.json())
.then(d => console.log(d))
```

**Очікуваний результат:**
```json
{
  "success": true,
  "message": "Playing on server",
  "file": "C:\\Users\\...\\pos12\\public\\music\\001.mp3"
}
```

### Тест 3: Веб-інтерфейс

1. Відкрийте: http://localhost:3000/test-music.html
2. Натисніть "Play Test Track"
3. Музика має грати на ПК

## Контрольний список

Перед запуском перевірте:

- [ ] Скопійовано всі файли проекту
- [ ] Папка `public/music/` містить MP3 файли
- [ ] Файл `app/api/music/play/route.ts` існує
- [ ] `serverPlayback={true}` в `app/page.tsx`
- [ ] PowerShell працює (запустіть `check-server-music.bat`)
- [ ] Колонки підключені до ПК (не до планшета!)
- [ ] Гучність Windows не на нулі
- [ ] Сервер запущено (`npm run dev`)
- [ ] Браузер відкрито на http://localhost:3000

## Порівняння режимів

| Параметр | Клієнтський режим | Серверний режим |
|----------|-------------------|-----------------|
| `serverPlayback` | `false` | `true` |
| Де грає музика | В браузері (планшет) | На ПК |
| API викликається | Ні | Так |
| Логи в консолі | Немає `[Server Music]` | Є `[Server Music]` |
| Потрібен PowerShell | Ні | Так |
| Колонки підключені | До планшета | До ПК |

## Типові помилки

### ❌ Музика грає на планшеті

```typescript
// НЕПРАВИЛЬНО
<MusicPlayer serverPlayback={false} />

// ПРАВИЛЬНО
<MusicPlayer serverPlayback={true} />
```

### ❌ Папка music порожня

```bash
# Перевірка
dir public\music\*.mp3

# Якщо порожня - скопіюйте файли
copy "\\старий-пк\pos12\public\music\*.mp3" "public\music\"
```

### ❌ API не відповідає

```bash
# Перевірте, чи запущено сервер
netstat -ano | findstr :3000

# Якщо немає - запустіть
npm run dev
```

## Автоматичне налаштування

Для автоматичного налаштування на новому ПК:

```bash
# 1. Встановіть залежності
npm install

# 2. Запустіть діагностику
check-server-music.bat

# 3. Якщо все OK - запустіть сервер
npm run dev

# 4. Відкрийте браузер
start http://localhost:3000
```

## Підтримка

Якщо проблема залишається:

1. Запустіть `check-server-music.bat` і збережіть вивід
2. Відкрийте консоль браузера (F12) і скопіюйте логи
3. Перевірте консоль сервера (де запущено `npm run dev`)
4. Перегляньте `MUSIC_TROUBLESHOOTING.md` для детальної діагностики

## Швидкі команди

```bash
# Діагностика
check-server-music.bat

# Тест PowerShell
test-music.bat

# Запуск сервера
npm run dev

# Тест API
start http://localhost:3000/test-music.html
```

Після виконання цих кроків музика має грати на ПК! 🎵
