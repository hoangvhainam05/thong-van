import "leaflet/dist/leaflet.css";
import "./globals.css";
import "./shell.css";
import AppShell from "@/components/AppShell";
import { StoreProvider } from "@/lib/store";

export const metadata = {
  title: "Thông Vân — Điện máy giao tận nhà",
  description: "Đặt hàng điện máy, theo dõi lịch giao và biết còn bao nhiêu điểm giao trước bạn.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body>
        <StoreProvider>
          <AppShell>{children}</AppShell>
        </StoreProvider>
      </body>
    </html>
  );
}
