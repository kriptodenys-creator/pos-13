@echo off
echo ========================================
echo   ШВИДКИЙ ПЕРЕЗАПУСК
echo ========================================
echo.

echo [1/2] Зупинка сервера...
taskkill /F /IM node.exe >NUL 2>&1
timeout /t 1 /nobreak >NUL

echo [2/2] Запуск...
call start-fast.bat
