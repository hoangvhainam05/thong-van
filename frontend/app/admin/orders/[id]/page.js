"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { PAYMENT_METHOD, routeOfOrder, useStore } from "@/lib/store";
import { dateLabel, dateTime, hm, vnd } from "@/lib/format";
import { haversineKm } from "@/lib/optimizer";
import { Can, RequirePerm } from "@/components/Guard";
import { PageHead } from "@/components/AdminShell";
import OrderTimeline from "@/components/OrderTimeline";
import RouteMap from "@/components/RouteMap";
import { Empty, Field, Modal, OrderBadge, RouteBadge } from "@/components/ui";

const CANCEL_REASONS = ["Khách đổi ý", "Hết hàng", "Không liên lạc được khách", "Khách đặt trùng đơn"];

function Detail() {
  const { id } = useParams();
  const { state, actions } = useStore();
  const [cancel, setCancel] = useState(null);
  const [loc, setLoc] = useState(null);
  const o = state.orders.find((x) => x.id === Number(id));
  if (!o) return <div className="panel"><Empty title="Không tìm thấy đơn" action={<Link className="btn" href="/admin/orders">Về danh sách</Link>} /></div>;
  const r = routeOfOrder(state, o.id);
  const stop = r?.stops.find((s) => s.orderId === o.id);
  const driver = r && state.drivers.find((d) => d.id === r.driverId);
  const vehicle = r && state.vehicles.find((v) => v.id === r.vehicleId);
  const depot = state.settings.depot;
  const install = o.items.reduce((s, it) => s + (state.products.find((p) => p.id === it.productId)?.install || 0) * it.qty, 0);
  const canEditLoc = !["SCHEDULED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"].includes(o.status);

  return (
    <>
      <Link href="/admin/orders" className="small muted">‹ Đơn hàng</Link>
      <PageHead title={`Đơn ${o.code}`} sub={`Đặt lúc ${dateTime(o.createdAt)}, giao ${dateLabel(o.deliveryDate).toLowerCase()} khung ${o.window.start}–${o.window.end}`}>
        <OrderBadge status={o.status} />
        <Can perm="order.confirm">
          {o.status === "PENDING" && <button className="btn" onClick={() => actions.confirmOrders([o.id])}>Xác nhận đơn</button>}
          {o.status === "CONFIRMED" && <button className="btn" onClick={() => actions.markReady([o.id])}>Đã chuẩn bị hàng</button>}
        </Can>
        <Can perm="order.cancel">
          {["PENDING", "CONFIRMED", "READY"].includes(o.status) && <button className="btn secondary" onClick={() => setCancel(CANCEL_REASONS[0])}>Huỷ đơn</button>}
        </Can>
      </PageHead>

      <div className="grid-3">
        <div className="stack">
          <section className="panel">
            <div className="panel-head"><h3>Sản phẩm</h3><span className="small muted">Lắp đặt dự kiến {install} phút</span></div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Sản phẩm</th><th className="num">Đơn giá</th><th className="num">SL</th><th className="num">Thành tiền</th></tr></thead>
                <tbody>
                  {o.items.map((it) => (
                    <tr key={it.productId}><td>{it.name}</td><td className="num">{vnd(it.price)}</td><td className="num">{it.qty}</td><td className="num">{vnd(it.price * it.qty)}</td></tr>
                  ))}
                  <tr><td colSpan={3} className="muted">Phí giao hàng</td><td className="num">{o.shippingFee ? vnd(o.shippingFee) : "Miễn phí"}</td></tr>
                  <tr><td colSpan={3}><b>Tổng cộng</b></td><td className="num"><b className="price">{vnd(o.total)}</b></td></tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h3>Vị trí giao hàng</h3>
              <Can perm="order.edit_location">{canEditLoc && <button className="btn secondary sm" onClick={() => setLoc({ lat: o.lat ?? "", lng: o.lng ?? "", address: o.address })}>Sửa vị trí</button>}</Can>
            </div>
            <div className="panel-body stack">
              <div className="small"><b>{o.address}</b>{o.district && <span className="muted">, {o.district}</span>}</div>
              {o.lat == null ? (
                <div className="notice warn">Chưa xác định được toạ độ từ địa chỉ khách nhập. Đơn này chưa thể chuyển sang sẵn sàng giao hoặc đưa vào tối ưu tuyến.</div>
              ) : (
                <>
                  <div className="small muted">Toạ độ {o.lat}, {o.lng}. Cách kho khoảng {(haversineKm(depot, o) * state.settings.roadFactor).toFixed(1)} km đường bộ.</div>
                  <RouteMap depot={depot} routes={[{ id: 1, name: o.code, stops: [{ lat: o.lat, lng: o.lng, seq: stop?.seq || "•" }] }]} height={260} />
                </>
              )}
            </div>
          </section>

          {r && (
            <section className="panel">
              <div className="panel-head"><h3>Tuyến giao</h3><RouteBadge status={r.status} /></div>
              <div className="panel-body small stack-sm">
                <div className="row between"><span className="muted">Tuyến</span><b>{r.code}</b></div>
                <div className="row between"><span className="muted">Thứ tự trong tuyến</span><b>Điểm {stop.seq}/{r.stops.length}</b></div>
                <div className="row between"><span className="muted">Giờ đến theo kế hoạch</span><b>{hm(stop.planned)}</b></div>
                <div className="row between"><span className="muted">Khung giờ báo khách</span><b>{hm(stop.etaStart)} – {hm(stop.etaEnd)}</b></div>
                {stop.arrivedAt != null && <div className="row between"><span className="muted">Thực tế đến</span><b>{hm(stop.arrivedAt)}</b></div>}
                <div className="row between"><span className="muted">Tài xế</span><b>{driver?.name || "Chưa phân công"}</b></div>
                <div className="row between"><span className="muted">Xe</span><b>{vehicle?.plate} ({vehicle?.type})</b></div>
              </div>
            </section>
          )}
        </div>

        <div className="stack">
          <section className="panel panel-pad stack-sm small">
            <h3>Khách hàng</h3>
            <div><b>{o.customerName}</b></div>
            <div><a href={`tel:${o.phone}`} style={{ color: "var(--road)" }}>{o.phone}</a></div>
            <div className="muted">{PAYMENT_METHOD[o.payment.method]}, {o.payment.status === "PAID" ? "đã thanh toán" : "chưa thanh toán"}</div>
            {o.note && <div className="notice">Ghi chú: {o.note}</div>}
            {o.failReason && <div className="notice bad">Lý do giao thất bại: {o.failReason}</div>}
          </section>
          <section className="panel panel-pad">
            <h3 style={{ marginBottom: 14 }}>Lịch sử</h3>
            <OrderTimeline order={o} showActor />
          </section>
        </div>
      </div>

      {cancel != null && (
        <Modal title={`Huỷ đơn ${o.code}`} onClose={() => setCancel(null)}
          footer={<><button className="btn secondary" onClick={() => setCancel(null)}>Giữ đơn</button><button className="btn danger" onClick={() => { actions.cancelOrder(o.id, cancel); setCancel(null); }}>Huỷ đơn</button></>}>
          <div className="choice">
            {CANCEL_REASONS.map((x) => (
              <label key={x}><input type="radio" name="reason" checked={cancel === x} onChange={() => setCancel(x)} />{x}</label>
            ))}
          </div>
          <p className="small muted" style={{ marginTop: 12 }}>Khách sẽ nhận thông báo kèm lý do huỷ.</p>
        </Modal>
      )}

      {loc && (
        <Modal title="Sửa vị trí giao hàng" onClose={() => setLoc(null)}
          footer={<><button className="btn secondary" onClick={() => setLoc(null)}>Huỷ</button><button className="btn" onClick={() => {
            const lat = Number(loc.lat), lng = Number(loc.lng);
            if (!lat || !lng) return;
            actions.setOrderLocation(o.id, lat, lng, loc.address);
            setLoc(null);
          }}>Lưu vị trí</button></>}>
          <div className="form-grid">
            <Field label="Địa chỉ" full><input className="input" value={loc.address} onChange={(e) => setLoc({ ...loc, address: e.target.value })} /></Field>
            <Field label="Vĩ độ"><input className="input" value={loc.lat} onChange={(e) => setLoc({ ...loc, lat: e.target.value })} placeholder="21.0xxx" /></Field>
            <Field label="Kinh độ"><input className="input" value={loc.lng} onChange={(e) => setLoc({ ...loc, lng: e.target.value })} placeholder="105.8xxx" /></Field>
            <p className="small muted full">Gọi khách xác nhận lại địa chỉ rồi lấy toạ độ từ Google Maps (nhấn giữ vào vị trí trên bản đồ để sao chép).</p>
            <button type="button" className="btn ghost sm full" onClick={() => setLoc({ ...loc, lat: (depot.lat + 0.03).toFixed(5), lng: (depot.lng - 0.06).toFixed(5) })}>Điền toạ độ mẫu để thử</button>
          </div>
        </Modal>
      )}
    </>
  );
}

export default function AdminOrderDetail() {
  return <RequirePerm perm="order.view_all"><Detail /></RequirePerm>;
}
