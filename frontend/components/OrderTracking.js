"use client";

import { PAYMENT_METHOD, queueInfo, useStore } from "@/lib/store";
import { dateLabel, hm, vnd } from "@/lib/format";
import OrderTimeline from "./OrderTimeline";
import RouteStrip from "./RouteStrip";
import { OrderBadge } from "./ui";

// Khối "theo dõi đơn" dùng chung cho khách đã đăng nhập và tra cứu bằng mã đơn.
export default function OrderTracking({ order, actions: extra }) {
  const { state } = useStore();
  const q = queueInfo(state, order);
  const headline = trackingHeadline(order, q);

  return (
    <div className="two-col">
      <div className="stack">
        <section className="panel panel-pad stack">
          <div className="row between">
            <div>
              <div className="small muted">Đơn {order.code} · giao {dateLabel(order.deliveryDate).toLowerCase()} · khung giờ bạn chọn {order.window.start}–{order.window.end}</div>
              <h2 style={{ fontSize: 24, marginTop: 6 }}>{headline.title}</h2>
              {headline.sub && <p className="muted" style={{ marginTop: 4 }}>{headline.sub}</p>}
            </div>
            <OrderBadge status={order.status} />
          </div>

          {q && !q.done && order.status !== "CANCELLED" && (
            <>
              <div className="kpis" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
                <div className="kpi" style={{ borderColor: "var(--signal)", background: "var(--signal-soft)" }}>
                  <div className="label">Vị trí của bạn</div>
                  <div className="value">#{q.position}<span className="muted" style={{ fontSize: 16, fontWeight: 600 }}> / {q.total} điểm còn lại</span></div>
                </div>
                <div className="kpi">
                  <div className="label">Còn trước bạn</div>
                  <div className="value">{q.before} điểm</div>
                </div>
                <div className="kpi">
                  <div className="label">Dự kiến xe tới</div>
                  <div className="value" style={{ fontSize: 20 }}>{hm(q.etaStart)} – {hm(q.etaEnd)}</div>
                  {q.lag > 0 && <div className="delta">Đã cập nhật theo tiến độ thực tế (+{q.lag} phút)</div>}
                </div>
              </div>
              <RouteStrip strip={q.strip} />
              {!q.locked && <div className="notice warn">Lịch giao đang được sắp xếp, thứ tự có thể thay đổi cho tới khi cửa hàng chốt tuyến.</div>}
              {q.locked && q.route.status === "LOCKED" && <div className="notice">Tuyến đã chốt. Thứ tự của bạn sẽ không bị đổi, xe sẽ xuất kho trong buổi sáng.</div>}
            </>
          )}
          {order.status === "FAILED" && <div className="notice bad">Giao chưa thành công: {order.failReason}. Cửa hàng sẽ gọi để hẹn lại lịch giao.</div>}
          {extra}
        </section>

        <section className="panel">
          <div className="panel-head"><h3>Sản phẩm</h3><span className="small muted">{PAYMENT_METHOD[order.payment.method]} · {order.payment.status === "PAID" ? "Đã thanh toán" : "Thanh toán khi nhận"}</span></div>
          <div className="panel-body stack-sm">
            {order.items.map((it) => (
              <div key={it.productId} className="row between small"><span className="grow">{it.name} × {it.qty}</span><span>{vnd(it.price * it.qty)}</span></div>
            ))}
            <div className="divider" />
            <div className="row between small"><span className="muted">Phí giao hàng</span><span>{order.shippingFee ? vnd(order.shippingFee) : "Miễn phí"}</span></div>
            <div className="row between"><b>Tổng cộng</b><b className="price">{vnd(order.total)}</b></div>
          </div>
        </section>
      </div>

      <aside className="stack">
        <section className="panel panel-pad">
          <h3 style={{ marginBottom: 14 }}>Trạng thái</h3>
          <OrderTimeline order={order} />
        </section>
        <section className="panel panel-pad stack-sm small">
          <h3>Giao tới</h3>
          <div><b>{order.customerName}</b> · {order.phone.replace(/(\d{4})(\d{3})(\d+)/, "$1 $2 $3")}</div>
          <div className="muted">{order.address}</div>
          {order.note && <div className="muted">Ghi chú: {order.note}</div>}
        </section>
      </aside>
    </div>
  );
}

function trackingHeadline(order, q) {
  switch (order.status) {
    case "PENDING": return { title: "Cửa hàng đã nhận đơn", sub: "Nhân viên sẽ gọi xác nhận trong ít phút." };
    case "CONFIRMED": return { title: "Đơn đã được xác nhận", sub: "Hàng đang được chuẩn bị tại kho." };
    case "READY": return { title: "Hàng đã sẵn sàng", sub: "Đơn sẽ được xếp vào tuyến giao trước ngày giao." };
    case "DELIVERED": return { title: "Đã giao thành công", sub: "Cảm ơn bạn đã mua sắm tại Thông Vân." };
    case "CANCELLED": return { title: "Đơn đã huỷ", sub: order.history.at(-1)?.note };
    case "FAILED": return { title: "Giao chưa thành công" };
    default:
      if (!q) return { title: "Đang xếp lịch giao" };
      if (q.route.status === "DRAFT") return { title: `Dự kiến giao ${hm(q.etaStart)} – ${hm(q.etaEnd)}`, sub: "Lịch sẽ được chốt trước khi xe xuất kho." };
      if (q.route.status === "LOCKED") return { title: `Bạn là điểm giao thứ ${q.position}`, sub: `Dự kiến ${hm(q.etaStart)} – ${hm(q.etaEnd)}.` };
      if (q.before === 0) return { title: "Tài xế đang trên đường tới bạn", sub: "Vui lòng để ý điện thoại." };
      return { title: `Còn ${q.before} điểm giao trước bạn`, sub: `Dự kiến xe tới ${hm(q.etaStart)} – ${hm(q.etaEnd)}.` };
  }
}
