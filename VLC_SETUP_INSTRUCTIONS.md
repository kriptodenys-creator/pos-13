# Налаштування VLC для серверного відтворення музики

## Крок 1: Завантаження та встановлення VLC

1. Завантажте VLC Media Player з офіційного сайту:
   https://www.videolan.org/vlc/

2. Встановіть VLC (стандартна інсталяція)
   - Запустіть інсталятор
   - Залишіть всі опції за замовчуванням
   - Завершіть встановлення

## Крок 2: Запуск VLC з HTTP інтерфейсом

### Варіант А: Через командний рядок (рекомендовано для сервера)

Відкрийте PowerShell та виконайте:

```powershell
& "C:\Program Files\VideoLAN\VLC\vlc.exe" --intf http --http-password admin --http-port 8080 --no-video --loop
```

**Параметри:**
- `--intf http` - включає HTTP інтерфейс
- `--http-password admin` - пароль для доступу (можна змінити)
- `--http-port 8080` - порт HTTP сервера
- `--no-video` - вимикає відео (тільки аудіо)
- `--loop` - повторює плейлист

### Варіант Б: Створення ярлика для автозапуску

1. Створіть файл `start-vlc-server.bat` з таким вмістом:

```batch
@echo off
"C:\Program Files\VideoLAN\VLC\vlc.exe" --intf http --http-password admin --http-port 8080 --no-video --loop --minimize-on-close
```

2. Збережіть файл та запускайте його для старту VLC сервера

### Варіант В: Автозапуск при старті Windows

1. Натисніть `Win + R`
2. Введіть `shell:startup`
3. Скопіюйте туди файл `start-vlc-server.bat`

## Крок 3: Перевірка роботи VLC HTTP інтерфейсу

Відкрийте браузер та перейдіть на:
```
http://localhost:8080
```

Введіть пароль: `admin`

Якщо бачите веб-інтерфейс VLC - все працює!

## Крок 4: Тестування API

Відкрийте PowerShell та виконайте:

```powershell
# Додати трек до плейлиста
Invoke-WebRequest -Uri "http://localhost:8080/requests/status.xml?command=in_play&input=C:\path\to\music.mp3" -Headers @{Authorization=("Basic " + [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("admin")))}

# Пауза
Invoke-WebRequest -Uri "http://localhost:8080/requests/status.xml?command=pl_pause" -Headers @{Authorization=("Basic " + [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("admin")))}

# Гучність (0-320, де 256 = 100%)
Invoke-WebRequest -Uri "http://localhost:8080/requests/status.xml?command=volume&val=200" -Headers @{Authorization=("Basic " + [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("admin")))}
```

## Крок 5: Готово!

Після запуску VLC з HTTP інтерфейсом, POS система зможе:
- ✅ Відтворювати музику
- ✅ Ставити на паузу (справжня пауза, не зупинка)
- ✅ Регулювати гучність в реальному часі
- ✅ Перемикати треки
- ✅ Показувати поточний час відтворення

## Налаштування безпеки (опціонально)

Якщо VLC буде доступний тільки локально, можна залишити пароль `admin`.

Для зміни пароля:
```powershell
--http-password YOUR_NEW_PASSWORD
```

## Порти

За замовчуванням VLC HTTP працює на порту 8080.
Переконайтеся, що цей порт не використовується іншими програмами.

Для зміни порту:
```powershell
--http-port 9090
```

## Troubleshooting

**VLC не запускається:**
- Перевірте, чи правильний шлях до vlc.exe
- Спробуйте запустити без параметрів спочатку

**HTTP інтерфейс не відкривається:**
- Перевірте, чи порт 8080 вільний
- Перевірте firewall Windows

**Помилка авторизації:**
- Перевірте пароль
- Спробуйте перезапустити VLC
