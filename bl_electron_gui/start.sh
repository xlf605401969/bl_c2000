#!/bin/bash

# Bootloader上位机启动脚本

echo "========================================"
echo "Bootloader上位机 - 启动脚本"
echo "========================================"
echo ""

# 检查Node.js是否安装
if ! command -v node &> /dev/null; then
    echo "错误: 未找到Node.js"
    echo "请先安装Node.js: https://nodejs.org/"
    exit 1
fi

echo "Node.js版本:"
node --version
echo ""

# 检查是否已安装依赖
if [ ! -d "node_modules" ]; then
    echo "首次运行，正在安装依赖..."
    echo ""
    npm install
    if [ $? -ne 0 ]; then
        echo "错误: 安装依赖失败"
        exit 1
    fi
    echo ""
    echo "依赖安装完成！"
    echo ""
fi

# 启动应用
echo "正在启动应用..."
echo ""
npm start
