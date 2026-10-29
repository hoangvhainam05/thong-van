#!/bin/bash
project_dir="$(cd "$(dirname "$0")/.." && pwd)" || exit 1
for part in frontend backend; do
  if [ ! -f "$project_dir/$part/package.json" ]; then
    echo "Không tìm thấy $part/package.json. Hãy giữ thư mục cong-cu trong thư mục dự án."
    read -r -p "Nhấn Enter để đóng..."; exit 1
  fi
done
echo "Sẽ xóa thư viện và bộ nhớ đệm của frontend và backend."
read -r -p "Nhập y để tiếp tục: " answer
case "$answer" in y|Y) ;; *) echo "Đã hủy."; exit 0 ;; esac
for part in frontend backend; do
  echo "Đang xóa thư viện và bộ nhớ đệm của $part..."
  if ! rm -rf -- "$project_dir/$part/node_modules" "$project_dir/$part/.npm-cache"; then
    read -r -p "Xóa thất bại. Nhấn Enter để đóng..."; exit 1
  fi
done
echo "Đã xóa xong. Dùng file cai-thu-vien-mac.command để cài lại."
read -r -p "Nhấn Enter để đóng..."
