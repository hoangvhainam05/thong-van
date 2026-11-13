"use client";

import { useEffect, useState } from "react";
import PaymentSupport from "@/components/PaymentSupport";
import { QRCodeSVG } from "qrcode.react";
import { api, vnd } from "@/lib/api";
import { dateLabel, dateTime } from "@/lib/format";
import { OrderBadge } from "@/components/ui";
import RouteStrip from "@/components/RouteStrip";
import Logistics3DSimulation from "./Logistics3DSimulation";
import { playTap } from "@/lib/audio-juice";
import {
  Truck,
  Clock,
  MapPin,
  CreditCard,
  Package,
  History,
  ShieldCheck,
  FileCheck,
  ExternalLink,
} from "lucide-react";

export default function RemoteTracking({ tracking, proofRequest, paymentRequest }) {
  const [proof, setProof] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [paymentLink, setPaymentLink] = useState(null);
  const [paymentSeconds, setPaymentSeconds] = useState(0);

  async function loadPayment() {
    setPaymentBusy(true);
    setPaymentError("");
    try {
      const result = await api(paymentRequest.path, paymentRequest.options);
      setPaymentLink(result);
    } catch (e) {
      setPaymentError(e.message);
    } finally {
      setPaymentBusy(false);
    }
  }

  useEffect(() => {
    if (
      paymentRequest &&
      tracking.payment_method === "PAYOS" &&
      tracking.payment_status !== "PAID" &&
      tracking.status !== "CANCELLED"
    ) {
      loadPayment();
    }
  }, [tracking.code, tracking.payment_method, tracking.payment_status, tracking.status]);

  useEffect(() => {
    if (!paymentLink?.expiresAt) return undefined;
    const tick = () =>
      setPaymentSeconds(
        Math.max(0, Math.ceil((new Date(paymentLink.expiresAt).getTime() - Date.now()) / 1000))
      );
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [paymentLink?.expiresAt]);

  const [view3D, setView3D] = useState(false);
  const time = (value) =>
    value ? new Date(value).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "—";
  const instructions = tracking.payment_instructions;
  const strip =
    tracking.position == null
      ? []
      : Array.from({ length: tracking.total_stops }, (_, i) => ({
          seq: i + 1,
          me: i + 1 === tracking.position,
          here: i === 0,
          done: false,
        }));

  async function showProof() {
    setBusy(true);
    setError("");
    try {
      const data = await api(proofRequest.path, proofRequest.options);
      setProof(data.url);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="two-col animate-pop-in">
      <div className="stack" style={{ gap: 20 }}>
        {/* Main Status Panel */}
        <section className="panel panel-pad stack" style={{ gap: 16 }}>
          <div className="row between" style={{ alignItems: "flex-start" }}>
            <div>
              <div className="small muted">
                Đơn <b>{tracking.code}</b> · Giao ngày {dateLabel(tracking.delivery_date)} · Khung hẹn {tracking.time_window}
              </div>
              <h2 style={{ fontSize: 24, marginTop: 6, color: "var(--ink)" }}>{tracking.message}</h2>
            </div>
            <OrderBadge status={tracking.status} />
          </div>

          {tracking.position != null && (
            <>
              <div className="kpis" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
                <div className="kpi" style={{ borderColor: "var(--signal)", background: "var(--signal-soft)" }}>
                  <div className="label">Vị trí của bạn</div>
                  <div className="value" style={{ color: "var(--signal-deep)" }}>
                    #{tracking.position}
                    <span className="muted" style={{ fontSize: 15, fontWeight: 600 }}>
                      {" "}/ {tracking.total_stops} điểm
                    </span>
                  </div>
                </div>
                <div className="kpi">
                  <div className="label">Còn trước bạn</div>
                  <div className="value" style={{ color: "var(--road)" }}>
                    {tracking.stops_before} điểm
                  </div>
                </div>
                <div className="kpi">
                  <div className="label">Dự kiến xe tới</div>
                  <div className="value" style={{ fontSize: 19 }}>
                    {time(tracking.eta_start)} – {time(tracking.eta_end)}
                  </div>
                </div>
              </div>

              <div className="row between" style={{ margin: "14px 0 6px" }}>
                <span className="small muted row" style={{ gap: 6, alignItems: "center" }}>
                  <Truck size={15} color="var(--signal)" />
                  <b>Hành trình giao hàng</b>
                </span>
                <div className="hud-pill-group">
                  <button
                    type="button"
                    className={`hud-pill ${!view3D ? "on" : ""}`}
                    onClick={() => {
                      setView3D(false);
                      playTap(700, 0.03);
                    }}
                  >
                    🚚 Tuyến đường
                  </button>
                  <button
                    type="button"
                    className={`hud-pill ${view3D ? "on" : ""}`}
                    onClick={() => {
                      setView3D(true);
                      playTap(900, 0.03);
                    }}
                  >
                    🌐 Sa bàn 3D
                  </button>
                </div>
              </div>

              {view3D ? (
                <div style={{ marginTop: 8 }}>
                  <Logistics3DSimulation height={300} showControls={true} />
                </div>
              ) : (
                <RouteStrip strip={strip} />
              )}

              {!tracking.route_locked && (
                <div className="notice warn">
                  Lịch giao đang được điều phối linh hoạt và có thể điều chỉnh trước khi chốt tuyến.
                </div>
              )}
            </>
          )}

          {tracking.requested_info?.length > 0 && (
            <div className="notice warn stack-sm">
              <b>Cửa hàng cần bạn bổ sung thông tin:</b>
              {tracking.requested_info.map((x, i) => (
                <div key={i}>{x.message}</div>
              ))}
            </div>
          )}

          {tracking.proof_available && (
            <div className="stack-sm" style={{ marginTop: 10 }}>
              <button className="btn secondary row" style={{ gap: 8 }} disabled={busy} onClick={showProof}>
                <FileCheck size={16} />
                <span>Xem ảnh bàn giao nghiệm thu</span>
              </button>
              {proof && (
                <a href={proof} target="_blank" rel="noreferrer" className="small row" style={{ gap: 6, color: "var(--road)" }}>
                  <span>Mở ảnh bàn giao (liên kết có hạn 5 phút)</span>
                  <ExternalLink size={13} />
                </a>
              )}
              {error && <div className="notice bad">{error}</div>}
            </div>
          )}
        </section>

        {/* Products Panel */}
        <section className="panel panel-pad stack-sm">
          <div className="row" style={{ gap: 8, alignItems: "center" }}>
            <Package size={18} color="var(--road)" />
            <h3>Sản phẩm trong đơn</h3>
          </div>
          {tracking.items?.map((item, i) => (
            <div key={i} className="row between small" style={{ padding: "8px 0", borderBottom: "1px solid var(--line-soft)" }}>
              <span>
                <b>{item.name}</b> × {item.quantity}
                {tracking.status === "DELIVERED" && (
                  <span className="tiny muted" style={{ display: "block" }}>
                    {item.warranty_months == null
                      ? "Chưa có dữ liệu thời hạn bảo hành"
                      : item.warranty_months === 0
                      ? "Không có thời hạn bảo hành"
                      : `Bảo hành ${item.warranty_months} tháng, đến trước ${item.warranty_end_exclusive
                          ?.split("-")
                          .reverse()
                          .join("/")}`}
                  </span>
                )}
              </span>
              <span className="price nowrap">{vnd(item.unit_price * item.quantity)}</span>
            </div>
          ))}
          <div className="row between small">
            <span className="muted">Phí giao hàng</span>
            <span>{vnd(tracking.shipping_fee)}</span>
          </div>
          <div className="divider" />
          <div className="row between">
            <b>Tổng cộng</b>
            <b className="price" style={{ fontSize: 18 }}>{vnd(tracking.total)}</b>
          </div>
        </section>

        {/* Timeline Panel */}
        <section className="panel panel-pad">
          <h3 style={{ marginBottom: 16 }}>Tiến trình đơn hàng</h3>
          <ul className="timeline">
            {tracking.timeline.map((item) => (
              <li key={item.status} className={item.state}>
                <span className="dot" />
                <div className="t-title">{item.label}</div>
              </li>
            ))}
          </ul>
        </section>

        {/* Update History */}
        <section className="panel panel-pad stack-sm">
          <div className="row" style={{ gap: 8, alignItems: "center" }}>
            <History size={17} color="var(--muted)" />
            <h3>Lịch sử cập nhật</h3>
          </div>
          {tracking.history?.length ? (
            tracking.history.map((event) => (
              <div key={event.id} className="small" style={{ padding: "6px 0", borderBottom: "1px solid var(--line-soft)" }}>
                <b>{event.label}</b> · <span className="muted">{dateTime(event.at)}</span>
                {event.note && <div className="muted">{event.note}</div>}
              </div>
            ))
          ) : (
            <p className="small muted">Chưa có lịch sử cập nhật.</p>
          )}
        </section>
      </div>

      {/* Right Column / Aside */}
      <aside className="stack" style={{ gap: 16 }}>
        {tracking.status === "DELIVERED" && (
          <section className="panel panel-pad stack-sm small">
            <div className="row" style={{ gap: 8, alignItems: "center" }}>
              <ShieldCheck size={18} color="var(--go)" />
              <h3>Liên hệ bảo hành</h3>
            </div>
            <div>{tracking.warranty_contact || "Liên hệ cửa hàng để được hỗ trợ bảo hành tận nhà."}</div>
          </section>
        )}

        <section className="panel panel-pad stack-sm small">
          <div className="row" style={{ gap: 8, alignItems: "center" }}>
            <MapPin size={18} color="var(--road)" />
            <h3>Địa chỉ giao hàng</h3>
          </div>
          <b>{tracking.recipient_name}</b>
          <div className="muted">{tracking.address}</div>
        </section>

        <section className="panel panel-pad stack-sm small">
          <div className="row" style={{ gap: 8, alignItems: "center" }}>
            <CreditCard size={18} color="var(--signal)" />
            <h3>Hình thức thanh toán</h3>
          </div>
          <div>
            <b>
              {tracking.payment_method === "PAYOS"
                ? "PayOS (Quét QR)"
                : tracking.payment_method === "BANK_TRANSFER"
                ? "Chuyển khoản ngân hàng"
                : tracking.payment_method === "COUNTER_CASH"
                ? "Tiền mặt tại quầy"
                : "Tiền mặt khi nhận hàng (COD)"}
            </b>
            {" · "}
            <span
              style={{
                color:
                  tracking.payment_status === "PAID"
                    ? "var(--go)"
                    : tracking.payment_status === "PENDING"
                    ? "var(--move)"
                    : "var(--stop)",
                fontWeight: 600,
              }}
            >
              {tracking.payment_status === "PAID"
                ? "Đã thanh toán"
                : tracking.payment_status === "PENDING"
                ? "Chờ thanh toán"
                : "Chưa thanh toán"}
            </span>
          </div>
        </section>

        {paymentRequest &&
          ["PAYOS", "BANK_TRANSFER"].includes(tracking.payment_method) &&
          tracking.payment_status !== "PAID" &&
          tracking.status !== "CANCELLED" && (
            <section className="panel panel-pad stack-sm">
              <h3>Thanh toán qua PayOS</h3>
              {tracking.payment_method === "BANK_TRANSFER" && !paymentLink && (
                <>
                  <p className="small muted">
                    Nếu đã chuyển khoản theo hướng dẫn cũ, liên hệ cửa hàng để đối soát trước khi tạo mã mới.
                  </p>
                  <button className="btn" disabled={paymentBusy} onClick={loadPayment}>
                    Tạo mã QR thanh toán
                  </button>
                </>
              )}
              {paymentBusy && <p className="small muted">Đang tạo mã thanh toán…</p>}
              {paymentLink?.qrCode && (
                <>
                  <p className="small muted">
                    Quét mã bằng ứng dụng ngân hàng để thanh toán {vnd(tracking.total)}.
                  </p>
                  <div style={{ background: "#fff", padding: 16, borderRadius: 12, alignSelf: "center", boxShadow: "0 4px 14px rgba(0,0,0,0.06)" }}>
                    <QRCodeSVG value={paymentLink.qrCode} size={200} title="Mã QR thanh toán PayOS" />
                  </div>
                  {paymentLink.expiresAt && (
                    <div className={paymentSeconds ? "notice warn" : "notice bad"}>
                      {paymentSeconds
                        ? `Mã QR còn hiệu lực ${Math.floor(paymentSeconds / 60)}:${String(
                            paymentSeconds % 60
                          ).padStart(2, "0")}`
                        : "Mã QR đã hết hạn. Tạo mã mới để tiếp tục thanh toán."}
                    </div>
                  )}
                </>
              )}
              {paymentLink?.details && (
                <div className="stack-sm small">
                  <div>Ngân hàng: <b>{paymentLink.details.bankCode}</b></div>
                  <div>Số tài khoản: <b>{paymentLink.details.accountNumber}</b></div>
                  {paymentLink.accountName && <div>Chủ tài khoản: <b>{paymentLink.accountName}</b></div>}
                  <div>Số tiền: <b>{vnd(tracking.total)}</b></div>
                  <div>Nội dung chuyển khoản: <b>{paymentLink.details.transferContent}</b></div>
                  <p className="muted">Nhập đúng số tiền và nội dung để hệ thống đối soát tự động.</p>
                </div>
              )}
              {paymentLink?.checkoutUrl && (
                <a className="btn secondary" href={paymentLink.checkoutUrl} target="_blank" rel="noreferrer">
                  Mở trang thanh toán PayOS
                </a>
              )}
              {paymentError && (
                <>
                  <div className="notice bad">{paymentError}</div>
                  <button className="btn secondary" disabled={paymentBusy} onClick={loadPayment}>
                    Thử lại
                  </button>
                </>
              )}
            </section>
          )}

        {paymentRequest &&
          ["PAYOS", "BANK_TRANSFER"].includes(tracking.payment_method) &&
          tracking.payment_status !== "PAID" && (
            <PaymentSupport orderId={tracking.id || paymentRequest.path.split("/")[3]} />
          )}

        {tracking.payment_method === "BANK_TRANSFER" && !paymentLink && tracking.payment_status === "PENDING" && (
          <section className="panel panel-pad stack-sm small">
            <h3>Hướng dẫn chuyển khoản</h3>
            {instructions?.configured ? (
              <>
                <div>Ngân hàng: <b>{instructions.bank_name}</b></div>
                <div>Tên tài khoản: <b>{instructions.account_name}</b></div>
                <div>Số tài khoản: <b>{instructions.account_number}</b></div>
                <div>Số tiền: <b>{vnd(instructions.amount)}</b></div>
                <div>Nội dung: <b>{instructions.transfer_content}</b></div>
              </>
            ) : (
              <div className="notice warn">Cửa hàng chưa cấu hình thông tin nhận chuyển khoản.</div>
            )}
          </section>
        )}
      </aside>
    </div>
  );
}
