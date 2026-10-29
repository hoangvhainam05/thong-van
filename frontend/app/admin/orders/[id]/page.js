"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PAYMENT_METHOD, useStore } from "@/lib/store";
import { dateLabel, dateTime, vnd } from "@/lib/format";
import { Can, RequirePerm } from "@/components/Guard";
import { PageHead } from "@/components/AdminShell";
import LocationPicker from "@/components/LocationPicker";
import CancelOrderModal from "@/components/CancelOrderModal";
import OrderTimeline from "@/components/OrderTimeline";
import { Empty, Field, Loading, Modal, OrderBadge } from "@/components/ui";


function Detail() {
  const { id } = useParams();
  const { state, actions } = useStore();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  useEffect(() => { actions.loadOrder(Number(id)).then(ok => { setFailed(!ok); setLoading(false); }); }, [id]);
  const [cancel, setCancel] = useState(null);
  const [infoRequest, setInfoRequest] = useState(null);
  const [loc, setLoc] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const o = state.orders.find((x) => x.id === Number(id));
  if (loading) return <Loading />;
  if (failed || !o || !o.serverId) return <div className="panel"><Empty title="Không tìm thấy đơn" action={<Link className="btn" href="/admin/orders">Về danh sách</Link>} /></div>;
  const install = o.items.reduce((s, it) => s + (it.install || 0) * it.qty, 0);
  const canEditLoc = !["SCHEDULED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"].includes(o.status);
  const canCancel = ["PENDING", "CONFIRMED", "READY", "SCHEDULED", "FAILED"].includes(o.status);

  return (
    <>
      <Link href="/admin/orders" className="small muted">‹ Đơn hàng</Link>
      <PageHead title={`Đơn ${o.code}`} sub={`Đặt lúc ${dateTime(o.createdAt)}, giao ${dateLabel(o.deliveryDate).toLowerCase()} khung ${o.window.start}–${o.window.end}`}>
        <OrderBadge status={o.status} />
        <Can perm="order.confirm">
          {o.payment.method === "BANK" && o.payment.status === "PENDING" && <button className="btn go" onClick={() => actions.markOrderPaid(o.id)}>Xác nhận đã nhận tiền</button>}
          {o.status === "PENDING" && (o.payment.method !== "BANK" || o.payment.status === "PAID") && <button className="btn" onClick={() => actions.confirmOrders([o.id])}>Xác nhận đơn</button>}
          {o.status === "CONFIRMED" && <button className="btn" onClick={() => actions.markReady([o.id])}>Đã chuẩn bị hàng</button>}
          {["PENDING", "CONFIRMED"].includes(o.status) && <button className="btn secondary" onClick={() => setInfoRequest("")}>Yêu cầu bổ sung</button>}
        </Can>
        <Can perm="order.cancel">
          {canCancel && <button className="btn secondary" onClick={() => setCancel(true)}>Huỷ đơn</button>}
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
                <div className="notice warn">Chưa xác định được toạ độ từ địa chỉ khách nhập. Có thể chuẩn bị hàng, nhưng cần cập nhật vị trí trước khi xếp tuyến.</div>
              ) : (
                <>
                  <div className="small muted">Toạ độ {o.lat}, {o.lng}.</div>
                  <a className="btn secondary" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${o.lat},${o.lng}`}>Xem trên Google Maps</a>
                </>
              )}
            </div>
          </section>

          {o.routeId && <section className="panel panel-pad small"><b>Tuyến {o.routeId} · điểm {o.sequence}</b><Can perm="dispatch.view"><div><Link href={`/admin/routes/${o.routeId}`}>Xem tuyến giao</Link></div></Can></section>}
        </div>

        <div className="stack">
          <section className="panel panel-pad stack-sm small">
            <h3>Khách hàng</h3>
            <div><b>{o.customerName}</b></div>
            <div><a href={`tel:${o.phone}`} style={{ color: "var(--road)" }}>{o.phone}</a></div>
            <div className="muted">{PAYMENT_METHOD[o.payment.method]}, {o.payment.status === "PAID" ? "đã thanh toán" : "chưa thanh toán"}</div>
            {o.isGift && <div className="notice">Đơn đặt hộ · Người nhận: <b>{o.recipientName}</b> · <a href={`tel:${o.recipientPhone}`}>{o.recipientPhone}</a></div>}
            {o.source === "COUNTER" && <div className="tiny muted">Đơn nhập tại quầy</div>}
            {o.note && <div className="notice">Ghi chú: {o.note}</div>}
            {o.failReason && <div className="notice bad">Lý do giao thất bại: {o.failReason}</div>}
          </section>
          <section className="panel panel-pad">
            <h3 style={{ marginBottom: 14 }}>Lịch sử</h3>
            <OrderTimeline order={o} showActor />
          </section>
        </div>
      </div>

      {cancel && <CancelOrderModal order={o} onClose={() => setCancel(null)} />}

      {infoRequest != null && (
        <Modal title={`Yêu cầu bổ sung cho ${o.code}`} onClose={() => setInfoRequest(null)}
          footer={<><button className="btn secondary" onClick={() => setInfoRequest(null)}>Đóng</button><button className="btn" disabled={infoRequest.trim().length < 5} onClick={async () => { const ok = await actions.requestOrderInfo(o.id, infoRequest.trim()); if (ok) setInfoRequest(null); }}>Gửi yêu cầu</button></>}>
          <Field label="Thông tin cần khách xác nhận" full><textarea className="input" rows={4} maxLength={255} value={infoRequest} onChange={(e) => setInfoRequest(e.target.value)} placeholder="Ví dụ: vui lòng xác nhận số nhà hoặc thời gian có thể nhận hàng" /></Field>
          <p className="small muted" style={{ marginTop: 8 }}>Yêu cầu được lưu vào lịch sử đơn. Nhân viên cần liên hệ khách qua kênh hiện có.</p>
        </Modal>
      )}

      {pickerOpen && loc && <LocationPicker initial={loc} onClose={() => setPickerOpen(false)} onSelect={(location) => { setLoc((current) => ({ ...current, ...location, address: location.address || current.address })); setPickerOpen(false); }} />}
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
            <button type="button" className="btn secondary full" onClick={() => setPickerOpen(true)}>Chọn vị trí trên bản đồ</button>
            <p className="small muted full">Gọi khách xác nhận và kiểm tra lại địa chỉ trước khi lưu.</p>
          </div>
        </Modal>
      )}
    </>
  );
}

export default function AdminOrderDetail() {
  return <RequirePerm perm="order.view_all"><Detail /></RequirePerm>;
}
