// Hình minh hoạ nét mảnh cho từng nhóm sản phẩm (thay cho ảnh thật trong bản demo).
const P = { fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round", strokeLinejoin: "round" };

const SHAPES = {
  washer: (
    <>
      <rect x="10" y="6" width="44" height="52" rx="5" {...P} />
      <line x1="10" y1="17" x2="54" y2="17" {...P} />
      <circle cx="32" cy="37" r="13" {...P} />
      <path d="M24 39c3 3 13 3 16-2" {...P} />
      <circle cx="18" cy="11.5" r="1.6" fill="currentColor" />
      <circle cx="24" cy="11.5" r="1.6" fill="currentColor" />
    </>
  ),
  fridge: (
    <>
      <rect x="15" y="4" width="34" height="56" rx="5" {...P} />
      <line x1="15" y1="25" x2="49" y2="25" {...P} />
      <line x1="21" y1="12" x2="21" y2="19" {...P} />
      <line x1="21" y1="32" x2="21" y2="42" {...P} />
    </>
  ),
  ac: (
    <>
      <rect x="6" y="14" width="52" height="20" rx="5" {...P} />
      <line x1="12" y1="28" x2="52" y2="28" {...P} />
      <path d="M18 42c0 4-3 6-3 10M32 42c0 4-3 6-3 10M46 42c0 4-3 6-3 10" {...P} />
    </>
  ),
  tv: (
    <>
      <rect x="6" y="10" width="52" height="34" rx="4" {...P} />
      <line x1="24" y1="54" x2="40" y2="54" {...P} />
      <line x1="32" y1="44" x2="32" y2="54" {...P} />
    </>
  ),
  dryer: (
    <>
      <rect x="10" y="6" width="44" height="52" rx="5" {...P} />
      <line x1="10" y1="17" x2="54" y2="17" {...P} />
      <circle cx="32" cy="37" r="13" {...P} />
      <path d="M27 33c2-3 4 3 6 0s4 3 6 0M27 40c2-3 4 3 6 0s4 3 6 0" {...P} />
    </>
  ),
  purifier: (
    <>
      <rect x="16" y="6" width="32" height="52" rx="6" {...P} />
      <path d="M32 18c-5 7-7 10-7 14a7 7 0 0 0 14 0c0-4-2-7-7-14z" {...P} />
      <line x1="24" y1="50" x2="40" y2="50" {...P} />
    </>
  ),
  heater: (
    <>
      <rect x="8" y="16" width="48" height="26" rx="13" {...P} />
      <line x1="24" y1="42" x2="24" y2="52" {...P} />
      <line x1="40" y1="42" x2="40" y2="52" {...P} />
      <circle cx="44" cy="29" r="3" {...P} />
    </>
  ),
  small: (
    <>
      <path d="M12 26h40v20a10 10 0 0 1-10 10H22a10 10 0 0 1-10-10z" {...P} />
      <path d="M18 26c0-7 6-12 14-12s14 5 14 12" {...P} />
      <line x1="32" y1="9" x2="32" y2="14" {...P} />
      <circle cx="44" cy="42" r="2" fill="currentColor" />
    </>
  ),
};

export const CATEGORY_ICON = {
  "may-giat": "washer", "tu-lanh": "fridge", "dieu-hoa": "ac", tivi: "tv",
  "may-say": "dryer", "loc-nuoc": "purifier", "nong-lanh": "heater", "gia-dung": "small",
};

export default function Art({ category, icon, className, label }) {
  const key = icon || CATEGORY_ICON[category] || "small";
  return (
    <svg viewBox="0 0 64 64" className={className} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {SHAPES[key]}
    </svg>
  );
}
