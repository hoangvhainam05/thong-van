#!/bin/bash
project_dir="$(cd "$(dirname "$0")/.." && pwd)" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v npm >/dev/null 2>&1; then
  echo "Chưa có Node.js. Cài Node.js 20 trở lên tại https://nodejs.org"
  read -r -p "Nhấn Enter để đóng..."; exit 1
fi
for part in frontend backend; do
  if [ ! -f "$project_dir/$part/package.json" ]; then
    echo "Không tìm thấy $part/package.json. Hãy giữ thư mục cong-cu trong thư mục dự án."
    read -r -p "Nhấn Enter để đóng..."; exit 1
  fi
done
for part in frontend backend; do
  echo "Đang cài thư viện $part..."
  if ! (cd "$project_dir/$part" && npm install --no-audit --no-fund); then
    read -r -p "Cài $part thất bại. Nhấn Enter để đóng..."; exit 1
  fi
done
echo "Đã cài xong thư viện."
read -r -p "Nhấn Enter để đóng..."
