#!/bin/bash
# Cập nhật nhánh hiện tại từ nhánh theo dõi, chỉ khi có thể tiến nhanh.
cd "$(dirname "$0")/.." || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v git >/dev/null 2>&1; then
  echo "Chưa có Git. Hãy cài Git rồi chạy lại."
  read -r -p "Nhấn Enter để đóng..."; exit 1
fi
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Không tìm thấy kho Git. Hãy giữ thư mục cong-cu trong thư mục dự án đã clone."
  read -r -p "Nhấn Enter để đóng..."; exit 1
fi
echo "Đang tải và cập nhật code cho nhánh hiện tại..."
if ! git pull --ff-only; then
  echo "Không thể cập nhật. Kiểm tra kết nối, nhánh theo dõi và các thay đổi đang có."
  echo "Nếu có xung đột hoặc nhánh đã tách lịch sử, hãy xử lý thủ công rồi chạy lại."
  read -r -p "Nhấn Enter để đóng..."; exit 1
fi
echo "Đã cập nhật code."
read -r -p "Nhấn Enter để đóng..."
