"""Theo dõi đơn cho khách: trạng thái, khung giờ ETA, "còn N đơn trước bạn"."""
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import DeliveryStop, Order, OrderStatus, Route, RouteStatus
from ..schemas import TrackingOut

router = APIRouter(prefix="/api/tracking", tags=["Theo dõi đơn"])

STEPS = [
    (OrderStatus.PENDING, "Đã đặt hàng"),
    (OrderStatus.CONFIRMED, "Đã xác nhận"),
    (OrderStatus.READY, "Đã chuẩn bị hàng"),
    (OrderStatus.SCHEDULED, "Đã xếp lịch giao"),
    (OrderStatus.OUT_FOR_DELIVERY, "Đang giao"),
    (OrderStatus.DELIVERED, "Đã giao"),
]
LABEL = dict(STEPS) | {OrderStatus.FAILED: "Giao không thành công", OrderStatus.CANCELLED: "Đã huỷ"}
DONE = {OrderStatus.DELIVERED, OrderStatus.FAILED}


@router.get("/{code}", response_model=TrackingOut)
def track(code: str, phone: str = Query(..., description="SĐT đặt hàng, để bảo vệ thông tin khách"),
          db: Session = Depends(get_db)):
    order = db.scalar(
        select(Order).options(
            selectinload(Order.customer),
            selectinload(Order.stop).selectinload(DeliveryStop.route)
            .selectinload(Route.stops).selectinload(DeliveryStop.order),
        ).where(Order.code == code.strip().upper())
    )
    # trả 404 giống nhau cho "sai mã" và "sai SĐT" để không dò được đơn của người khác
    if order is None or order.customer.phone != phone.strip():
        raise HTTPException(404, "Không tìm thấy đơn hàng")

    order_idx = next((i for i, (st, _) in enumerate(STEPS) if st == order.status), None)
    timeline = []
    for i, (st, label) in enumerate(STEPS):
        state = "todo"
        if order_idx is not None:
            state = "done" if i < order_idx else "current" if i == order_idx else "todo"
        timeline.append({"status": st.value, "label": label, "state": state})

    out = TrackingOut(
        code=order.code, status=order.status.value, status_label=LABEL[order.status], timeline=timeline,
        delivery_date=order.delivery_date,
        time_window=f"{order.time_window_start:%H:%M}–{order.time_window_end:%H:%M}",
        message=LABEL[order.status],
    )

    stop = order.stop
    if stop is None or order.status in DONE | {OrderStatus.CANCELLED}:
        if order.status == OrderStatus.DELIVERED:
            out.message = "Đơn hàng đã được giao. Cảm ơn bạn!"
        elif order.status in {OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.READY}:
            out.message = "Đơn hàng sẽ được xếp lịch giao trước ngày giao."
        return out

    route = stop.route
    remaining = [s for s in route.stops if s.order.status not in DONE]
    before = [s for s in remaining if s.sequence < stop.sequence]

    # ETA: dịch theo độ trễ thực tế của điểm gần nhất tài xế đã tới
    eta_start, eta_end = stop.eta_start, stop.eta_end
    arrived = [s for s in route.stops if s.actual_arrival is not None]
    if route.status == RouteStatus.IN_PROGRESS and arrived:
        last = max(arrived, key=lambda s: s.sequence)
        lag = last.actual_arrival - last.planned_arrival
        if lag > timedelta(0):
            eta_start, eta_end = eta_start + lag, eta_end + lag

    out.position = len(before) + 1
    out.total_stops = len(remaining)
    out.stops_before = len(before)
    out.route_locked = route.status != RouteStatus.DRAFT
    out.eta_start, out.eta_end = eta_start, eta_end

    window = f"{eta_start:%H:%M}–{eta_end:%H:%M}"
    if route.status == RouteStatus.DRAFT:
        out.message = f"Dự kiến giao trong khoảng {window} (lịch có thể còn điều chỉnh)."
    elif route.status == RouteStatus.LOCKED:
        out.message = f"Bạn là điểm giao thứ {out.position} trong tuyến. Dự kiến {window}."
    elif not before:
        out.message = f"Tài xế đang trên đường tới chỗ bạn. Dự kiến {window}."
    else:
        out.message = f"Còn {len(before)} điểm giao trước bạn. Dự kiến {window}."
    if eta_end < datetime.now() and route.status == RouteStatus.IN_PROGRESS:
        out.message += " Tuyến đang chậm hơn dự kiến, xin lỗi vì sự bất tiện."
    return out
