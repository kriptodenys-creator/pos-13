@echo off
echo ========================================
echo   PRODUCTION РЕЖИМ (НАЙШВИДШИЙ)
echo ========================================
echo.

REM Зупинка старих процесів
tasklist /FI "IMAGENAME eq node.exe" 2>NUL | find /I /N "node.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo [УВАГА] Зупиняємо старі процеси...
    taskkill /F /IM node.exe >NUL 2>&1
    timeout /t 2 /nobreak >NUL
)

echo [1/4] Перевірка збірки...
if not exist .next\BUILD_ID (
    echo [INFO] Production збірка не знайдена. Створюємо...
    echo [2/4] Збірка проекту (може зайняти 1-2 хвилини)...
    call npm run build
    if errorlevel 1 (
        echo [ПОМИЛКА] Збірка не вдалася!
        pause
        exit /b 1
    )
) else (
    echo [INFO] Використовуємо існуючу збірку
    echo [2/4] Пропускаємо збірку...
)

echo [3/4] Налаштування...
set NODE_ENV=production
set NEXT_TELEMETRY_DISABLED=1
set NODE_OPTIONS=--max-old-space-size=2048

echo [4/4] Запуск production сервера...
echo.
echo ========================================
echo   PRODUCTION СЕРВЕР ЗАПУЩЕНО
echo   Відкрийте: http://localhost:3000
echo   
echo   Це ШВИДШИЙ режим (pre-compiled)
echo ========================================
echo.

npm start

pause
