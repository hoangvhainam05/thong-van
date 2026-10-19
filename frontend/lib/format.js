export const vnd = (n) => new Intl.NumberFormat("vi-VN").format(Math.round(n || 0)) + "\u00a0₫";

export const vndShort = (n) => {
  if (n >= 1e9) return (n / 1e9).toFixed(1).replace(".", ",") + " tỷ";
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(".", ",") + " tr";
  return vnd(n);
};

export const num = (n, d = 0) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: d }).format(n || 0);

// Ngày dạng chuỗi 'YYYY-MM-DD' theo giờ máy
export function ymd(d = new Date()) {
  const x = new Date(d);
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${x.getFullYear()}-${m}-${day}`;
}

export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return ymd(new Date(y, m - 1, d + n));
}

export function dateLabel(dateStr) {
  const today = ymd();
  if (dateStr === today) return "Hôm nay";
  if (dateStr === addDays(today, 1)) return "Ngày mai";
  if (dateStr === addDays(today, -1)) return "Hôm qua";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

export function shortDate(dateStr) {
  const [, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}

// phút trong ngày -> 'HH:MM'
export const hm = (min) => {
  if (min == null) return "—";
  const h = Math.floor(min / 60) % 24;
  const m = Math.round(min % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

export const toMin = (s) => {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
};

export const dateTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export const ago = (iso) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "vừa xong";
  if (s < 3600) return `${Math.floor(s / 60)} phút trước`;
  if (s < 86400) return `${Math.floor(s / 3600)} giờ trước`;
  return `${Math.floor(s / 86400)} ngày trước`;
};

export const initials = (name = "") =>
  name.split(" ").filter(Boolean).slice(-2).map((w) => w[0]).join("").toUpperCase();
