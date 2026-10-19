"use client";

import { useState } from "react";
import { PAYMENT_METHOD, useStore } from "@/lib/store";
import { hm, vnd, ymd } from "@/lib/format";
import { Empty, Modal, RouteBadge } from "@/components/ui";

const FAIL = ["Khách không có nhà", "Không liên lạc được khách", "Khách hẹn giao lại ngày khác", "Sai địa chỉ", "Không đủ chỗ lắp đặt", "Hàng lỗi, khách từ chối nhận"];

export default function DriverToday() {
  const { state, user, actions } = useStore();
  const [fail, setFail] = useState(null);
  const route = state.routes.find((r) => r.driverId === user.driverId && r.date === ymd() && r.status !== "DRAFT");
  const vehicle = route && state.vehicles.find((v) => v.id === route.vehicleId);

  if (!route)
    return <div className="panel"><Empty title="Hôm nay bạn chưa có tuyến">Tuyến sẽ hiện ở đây sau khi quản lý chốt lịch giao.</Empty></div>;

  const rows = route.stops.map((s) => ({ s, o: state.orders.find((x) => x.id === s.orderId) }));
  const done = rows.filter((x) => x.s.completedAt != null).length;
  const next = rows.find((x) => x.s.completedAt == null);
  const cod = rows.filter(({ o, s }) => o.payment.method === "COD" && s.result !== "FAILED").reduce((sum, { o }) => sum + o.total, 0);
  const install = (o) => o.items.reduce((s, it) => s + (state.products.find((p) => p.id === it.productId)?.install || 0) * it.qty, 0);

  return (
    <div className="stack">
      <section className="panel panel-pad stack-sm">
        <div className="row between">
          <div><b>Tuyến {route.code}</b><div className="small muted">{vehicle?.plate}, {route.stops.length} điểm, {route.totalKm} km</div></div>
          <RouteBadge status={route.status} />
        </div>
        <div className="progress"><span style={{ width: `${(done / route.stops.length) * 100}%` }} /></div>
        <div className="row between small"><span>Đã giao {done}/{route.stops.length} điểm</span><span className="muted">Thu hộ cả tuyến {vnd(cod)}</span></div>
      </section>

      {route.status === "LOCKED" && <div className="notice warn">Tuyến đã chốt, đang chờ quản lý bấm xuất kho. Kiểm tra hàng lên xe theo thứ tự ngược với thứ tự giao.</div>}
      {route.status === "DONE" && <div className="notice ok">Bạn đã hoàn tất tuyến hôm nay. Bàn giao tiền thu hộ cho kế toán khi về kho.</div>}

      {route.status === "IN_PROGRESS" && next && (
        <section className="next-stop">
          <div className="ns-head"><span>Điểm tiếp theo: số {next.s.seq}</span><span>Kế hoạch {hm(next.s.planned)}</span></div>
          <div className="ns-body">
            <div>
              <div className="addr">{next.o.address}</div>
              <div className="small muted">Khách hẹn {next.o.window.start}–{next.o.window.end}</div>
            </div>
            <div className="row between">
              <div><b>{next.o.customerName}</b><div className="small muted">{next.o.phone}</div></div>
              <a className="btn secondary" href={`tel:${next.o.phone}`}>Gọi khách</a>
            </div>
            <div className="small stack-sm" style={{ background: "var(--ground)", padding: 12, borderRadius: 8 }}>
              {next.o.items.map((it) => <div key={it.productId}>{it.qty} × {it.name}</div>)}
              {install(next.o) > 0 && <div className="muted">Lắp đặt khoảng {install(next.o)} phút</div>}
              {next.o.note && <div style={{ color: "var(--move)", fontWeight: 600 }}>Ghi chú: {next.o.note}</div>}
              <div><b>{next.o.payment.status === "PAID" ? "Đã thanh toán, không thu tiền" : `Thu ${vnd(next.o.total)} (${PAYMENT_METHOD[next.o.payment.method]})`}</b></div>
            </div>
            <a className="btn secondary block" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${next.o.lat},${next.o.lng}`}>Chỉ đường bằng Google Maps</a>
            {next.s.arrivedAt == null ? (
              <button className="btn lg block signal" onClick={() => actions.arriveStop(route.id, next.o.id)}>Tôi đã đến nơi</button>
            ) : (
              <div className="big-actions">
                <button className="btn danger" onClick={() => setFail({ orderId: next.o.id, reason: FAIL[0] })}>Không giao được</button>
                <button className="btn go" onClick={() => actions.completeStop(route.id, next.o.id, true)}>Giao thành công</button>
              </div>
            )}
            <p className="tiny muted">Khách đang thấy họ là điểm giao kế tiếp. Bấm “Tôi đã đến nơi” để cập nhật giờ dự kiến cho các khách phía sau.</p>
          </div>
        </section>
      )}

      <section className="panel">
        <div className="panel-head"><h3>Thứ tự giao</h3><span className="small muted">Theo tuyến tối ưu, không đổi thứ tự khi đang chạy</span></div>
        {rows.map(({ s, o }) => (
          <div key={s.seq} className="d-stop" style={{ opacity: s.completedAt != null ? 0.6 : 1 }}>
            <span className={`seq ${s.completedAt != null ? "done" : next && s.seq === next.s.seq ? "here" : ""}`}>{s.completedAt != null ? "✓" : s.seq}</span>
            <div className="small">
              <div className="row between"><b>{o.customerName}</b><span className="nowrap">{hm(s.completedAt != null ? s.arrivedAt : s.planned)}</span></div>
              <div className="muted">{o.address}</div>
              <div className="tiny muted">Hẹn {o.window.start}–{o.window.end}{s.result === "FAILED" ? `, thất bại: ${o.failReason}` : s.result === "DELIVERED" ? ", đã giao" : ""}</div>
            </div>
          </div>
        ))}
      </section>

      {fail && (
        <Modal title="Không giao được" onClose={() => setFail(null)}
          footer={<><button className="btn secondary" onClick={() => setFail(null)}>Quay lại</button><button className="btn danger" onClick={() => { actions.completeStop(route.id, fail.orderId, false, fail.reason); setFail(null); }}>Xác nhận</button></>}>
          <div className="choice">
            {FAIL.map((r) => <label key={r}><input type="radio" name="fail" checked={fail.reason === r} onChange={() => setFail({ ...fail, reason: r })} />{r}</label>)}
          </div>
          <p className="small muted" style={{ marginTop: 12 }}>Khách nhận thông báo kèm lý do. Đơn sẽ quay về cửa hàng để hẹn lịch mới.</p>
        </Modal>
      )}
    </div>
  );
}
