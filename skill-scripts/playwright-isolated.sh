#!/bin/bash

# 设置起始端口
PORT=5173

# 循环检测端口是否被占用 (兼容 macOS/Linux)
while lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null ; do
    echo "⚠️  Port $PORT is in use, trying next..."
    PORT=$((PORT+1))
done

echo "🚀 Starting Playwright tests on port $PORT..."
if [ $# -gt 0 ]; then
    echo "📦 Passing arguments: $@"
fi

# 核心修改：将找到的空闲端口作为环境变量注入，并将所有传入的参数 ("$@") 透传给 playwright
PORT=$PORT npx playwright test "$@"