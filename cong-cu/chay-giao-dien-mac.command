#!/bin/bash
# Chạy giao diện demo Thông Vân tại http://localhost:3000
cd "$(dirname "$0")/../frontend" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v npm >/dev/null 2>&1; then
  echo "Chưa có Node.js. Cài Node.js 20 trở lên tại https://nodejs.org"
  read -r -p "Nhấn Enter để đóng..."; exit 1
fi
echo "Node $(node --version), npm $(npm --version)"
if [ ! -d node_modules/next ]; then
  echo "Đang cài thư viện giao diện..."
  if ! npm install --no-audit --no-fund; then
    read -r -p "Cài thất bại. Nhấn Enter để đóng..."; exit 1
  fi
fi
echo "Mở http://localhost:3000 — nhấn Ctrl+C hoặc đóng cửa sổ để dừng."
npm run dev
