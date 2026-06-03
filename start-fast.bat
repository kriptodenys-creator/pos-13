@echo off
echo ========================================
echo   ШВИДКИЙ ЗАПУСК POS СИСТЕМИ
echo ========================================
echo.

REM Перевірка чи запущено Node.js процес
tasklist /FI "IMAGENAME eq node.exe" 2>NUL | find /I /N "node.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo [УВАГА] Node.js вже запущено. Зупиняємо старі процеси...
    taskkill /F /IM node.exe >NUL 2>&1
    timeout /t 2 /nobreak >NUL
)

REM Очистка кешу Next.js для свіжого старту
echo [1/3] Очистка кешу...
if exist .next\cache rmdir /s /q .next\cache >NUL 2>&1

REM Встановлення змінних середовища для швидкості
echo [2/3] Налаштування оптимізації...
set NODE_ENV=development
set NEXT_TELEMETRY_DISABLED=1
set NODE_OPTIONS=--max-old-space-size=4096

REM Запуск сервера
echo [3/3] Запуск сервера...
echo.
echo ========================================
echo   Сервер запускається...
echo   Відкрийте: http://localhost:3000
echo ========================================
echo.

npm run dev

pause
