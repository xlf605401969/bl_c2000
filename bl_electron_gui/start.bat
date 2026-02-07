@echo off
REM Bootloader上位机启动脚本

echo ========================================
echo Bootloader上位机 - 启动脚本
echo ========================================
echo.

REM 检查Node.js是否安装
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo 错误: 未找到Node.js
    echo 请先安装Node.js: https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js版本:
node --version
echo.

REM 检查是否已安装依赖
if not exist "node_modules" (
    echo 首次运行，正在安装依赖...
    echo.
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo 错误: 安装依赖失败
        pause
        exit /b 1
    )
    echo.
    echo 依赖安装完成！
    echo.
)

REM 启动应用
echo 正在启动应用...
echo.
call npm start

pause
