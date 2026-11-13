"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { RequirePerm } from "./Guard";
import SoundToggle from "./SoundToggle";
import { playTap } from "@/lib/audio-juice";
import { Truck, History, LogOut } from "lucide-react";

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
        <img className="logo-mark logo-symbol" src="/brand-symbol.png" alt="Thông Vân" />
        <div className="grow">
          <div className="strong row" style={{ gap: 6, alignItems: "center" }}>
            <span>{user.name}</span>
            <span className="live-dot" title="Đang trực tuyến" />
          </div>
          <div className="tiny" style={{ color: "#a9bfdc" }}>Tài xế giao hàng & lắp đặt</div>
        </div>
        <SoundToggle />
        <button
          className="btn ghost sm"
          style={{ color: "#fff", padding: "6px 10px" }}
          onClick={() => {
            playTap(600, 0.03);
            actions.logout();
            router.push("/login");
          }}
          aria-label="Đăng xuất"
        >
          <LogOut size={16} />
        </button>
      </header>
      <main className="driver-main">{children}</main>
      <nav className="driver-tabs">
        <Link
          href="/driver"
          className={pathname === "/driver" ? "on" : ""}
          onClick={() => playTap(700, 0.03)}
        >
          <Truck size={17} />
          <span>Tuyến hôm nay</span>
        </Link>
        <Link
          href="/driver/history"
          className={pathname === "/driver/history" ? "on" : ""}
          onClick={() => playTap(700, 0.03)}
        >
          <History size={17} />
          <span>Lịch sử</span>
        </Link>
      </nav>
    </div>
  );
}

