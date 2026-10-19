#!/bin/bash
# Chạy giao diện demo Thông Vân tại http://localhost:3000
cd "$(dirname "$0")/frontend" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v npm >/dev/null 2>&1; then
  echo "Chưa có Node.js. Cài bằng: brew install node   (hoặc tải ở https://nodejs.org)"
  read -n 1 -s -r -p "Nhấn phím bất kỳ để đóng"; exit 1
fi
echo "Node $(node --version), npm $(npm --version)"
if [ ! -d node_modules/next ]; then
  echo "Đang cài thư viện (lần đầu mất 1–2 phút)..."
  npm install --no-audit --no-fund --cache "$(pwd)/.npm-cache" || { read -n 1 -s -r -p "Cài thất bại. Nhấn phím bất kỳ để đóng"; exit 1; }
fi
echo "Mở http://localhost:3000 — đóng cửa sổ này hoặc nhấn Ctrl+C để dừng."
npm run dev
