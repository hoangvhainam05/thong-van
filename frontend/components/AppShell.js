"use client";

import { usePathname } from "next/navigation";
import { useStore } from "@/lib/store";
import ShopShell from "./ShopShell";
import { Toasts } from "./ui";

// Chọn khung giao diện theo khu vực: cửa hàng, quản trị (/admin), tài xế (/driver), đăng nhập.
export default function AppShell({ children }) {
  const pathname = usePathname() || "/";
  const { toasts } = useStore();
  const bare = ["/admin", "/driver", "/login", "/register"].some((p) => pathname === p || pathname.startsWith(p + "/"));
  return (
    <>
      {bare ? children : <ShopShell>{children}</ShopShell>}
      <Toasts items={toasts} />
    </>
  );
}
