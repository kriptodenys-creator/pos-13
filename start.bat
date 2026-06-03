@echo off
chcp 65001 >nul
echo ========================================
echo 🚀 Запуск POS системы
echo ========================================
echo.
echo Запуск сервера...
echo.
echo Приложение будет доступно по адресу:
echo   http://localhost:3000
echo.
echo Для остановки нажмите Ctrl+C
echo.
echo ========================================
echo.

call npm run dev
