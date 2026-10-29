#!/usr/bin/env bash
# Chạy từ thư mục backend. Không hỗ trợ DATABASE_URL: đặt DB_* trong môi trường.
set -euo pipefail
umask 077
if [[ -n "${DATABASE_URL:-}" ]]; then
  printf '%s\n' 'Script cần DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_DATABASE thay vì DATABASE_URL.' >&2
  exit 1
fi
: "${DB_USERNAME:?Cần DB_USERNAME}" "${DB_PASSWORD:?Cần DB_PASSWORD}" "${DB_DATABASE:?Cần DB_DATABASE}"
backup_dir="${BACKUP_DIR:-../backups}"
mkdir -p "$backup_dir"
backup_path="$backup_dir/thongvan-$(date +%Y%m%d-%H%M%S).sql.gz"
if [[ -e "$backup_path" ]]; then printf '%s\n' 'Bản sao lưu cùng tên đã tồn tại.' >&2; exit 1; fi
backup_tmp=$(mktemp "$backup_dir/.thongvan-XXXXXX")
trap 'rm -f "$backup_tmp"' EXIT
MYSQL_PWD="$DB_PASSWORD" mysqldump --host="${DB_HOST:-127.0.0.1}" --port="${DB_PORT:-3306}" --user="$DB_USERNAME" --single-transaction --quick --no-tablespaces --set-gtid-purged=OFF --routines --triggers -- "$DB_DATABASE" | gzip > "$backup_tmp"
if ! ln "$backup_tmp" "$backup_path"; then
  printf '%s\n' 'Không tạo được tên bản sao lưu; có thể bản cùng tên đã tồn tại.' >&2
  exit 1
fi
rm -f "$backup_tmp"
trap - EXIT
printf 'Đã tạo bản sao lưu: %s\n' "$backup_path"
