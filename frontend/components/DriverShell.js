"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { RequirePerm } from "./Guard";


export default function DriverShell({ children }) {
  return (
    <RequirePerm perm="delivery.app">
      <Frame>{children}</Frame>
    </RequirePerm>
  );
}

function Frame({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, actions } = useStore();
  return (
    <div className="driver">
      <header className="driver-top">
        <span className="logo-mark">TV</span>
        <div className="grow">
          <div className="strong">{user.name}</div>
          <div className="tiny" style={{ color: "#a9bfdc" }}>Nhân viên giao hàng</div>
        </div>
        <button className="btn ghost sm" style={{ color: "#fff" }} onClick={() => { actions.logout(); router.push("/login"); }}>Đăng xuất</button>
      </header>
      <main className="driver-main">{children}</main>
      <nav className="driver-tabs">
        <Link href="/driver" className={pathname === "/driver" ? "on" : ""}>Tuyến hôm nay</Link>
        <Link href="/driver/history" className={pathname === "/driver/history" ? "on" : ""}>Lịch sử</Link>
      </nav>
    </div>
  );
}

