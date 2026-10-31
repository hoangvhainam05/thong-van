export function resolveUrl(path) {
  let url = path;
  // On the server (runtime functions / SSR), use the Vercel service binding BACKEND_URL
  if (typeof window === "undefined") {
    const baseUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
    const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
    url = new URL(normalizedPath, normalizedBase).toString();
  } else if (process.env.NEXT_PUBLIC_API_URL) {
    // In the browser (client-side):
    // If NEXT_PUBLIC_API_URL is configured (e.g. for standalone local dev), resolve against it.
    // Otherwise, return relative path so requests route to the same origin through Vercel rewrites.
    const normalizedBase = process.env.NEXT_PUBLIC_API_URL.endsWith("/")
      ? process.env.NEXT_PUBLIC_API_URL
      : `${process.env.NEXT_PUBLIC_API_URL}/`;
    const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
    url = new URL(normalizedPath, normalizedBase).toString();
  }

  // Restore Leaflet URL template placeholders ({z}, {x}, {y}, {s}, {r}) that new URL() percent-encodes
  return url
    .replace(/%7Bz%7D/gi, "{z}")
    .replace(/%7Bx%7D/gi, "{x}")
    .replace(/%7By%7D/gi, "{y}")
    .replace(/%7Bs%7D/gi, "{s}")
    .replace(/%7Br%7D/gi, "{r}");
}

export async function api(path, { method = "GET", body, token } = {}) {
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const headers = isForm ? {} : { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const url = resolveUrl(path);
  const res = await fetch(url, {
    method,
    headers,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = data?.detail;
    const apiMessage = data?.message;
    const msg = Array.isArray(detail)
      ? detail.map((d) => d.msg || d.message || String(d)).join("; ")
      : detail || (Array.isArray(apiMessage) ? apiMessage.join("; ") : apiMessage);
    const error = new Error(msg || `Lỗi ${res.status}`);
    error.status = res.status;
    throw error;
  }
  return data;
}

export const vnd = (n) => new Intl.NumberFormat("vi-VN").format(n) + " ₫";

export const hhmm = (iso) =>
  iso ? new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "—";

export const today = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

// Token nhân viên lưu trong sessionStorage (mất khi đóng tab)
export const loadToken = () => {
  try {
    return sessionStorage.getItem("tv_session_token") || "";
  } catch {
    return "";
  }
};
export const saveToken = (t) => {
  try {
    sessionStorage.setItem("tv_session_token", t);
  } catch {}
};

export const STATUS_LABEL = {
  PENDING: "Chờ xác nhận",
  CONFIRMED: "Đã xác nhận",
  READY: "Sẵn sàng giao",
  SCHEDULED: "Đã xếp lịch",
  OUT_FOR_DELIVERY: "Đang giao",
  DELIVERED: "Đã giao",
  FAILED: "Giao thất bại",
  CANCELLED: "Đã huỷ",
};
