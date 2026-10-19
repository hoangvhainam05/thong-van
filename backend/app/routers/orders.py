from datetime import date
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..deps import require_staff
from ..models import Customer, Order, OrderItem, OrderStatus, Product
from ..schemas import LocationUpdate, OrderCreate, OrderItemOut, OrderOut, StatusUpdate

router = APIRouter(prefix="/api/orders", tags=["Đơn hàng"])

# chuyển trạng thái hợp lệ mà nhân viên được thao tác tay
ALLOWED = {
    OrderStatus.PENDING: {OrderStatus.CONFIRMED, OrderStatus.CANCELLED},
    OrderStatus.CONFIRMED: {OrderStatus.READY, OrderStatus.CANCELLED},
    OrderStatus.READY: {OrderStatus.CANCELLED},
}


def to_out(o: Order) -> OrderOut:
    return OrderOut(
        id=o.id, code=o.code or "", customer_name=o.customer.name, phone=o.customer.phone,
        address=o.address, lat=float(o.lat) if o.lat is not None else None,
        lng=float(o.lng) if o.lng is not None else None,
        delivery_date=o.delivery_date, time_window_start=o.time_window_start,
        time_window_end=o.time_window_end, total=float(o.total), payment_method=o.payment_method,
        status=o.status.value,
        items=[OrderItemOut(product_name=i.product.name, quantity=i.quantity, unit_price=float(i.unit_price))
               for i in o.items],
        route_id=o.stop.route_id if o.stop else None,
        sequence=o.stop.sequence if o.stop else None,
    )


def _load(db: Session):
    return select(Order).options(
        selectinload(Order.customer), selectinload(Order.items).selectinload(OrderItem.product),
        selectinload(Order.stop),
    )


@router.post("", response_model=OrderOut, status_code=201)
def create_order(body: OrderCreate, db: Session = Depends(get_db)):
    if body.delivery_date < date.today():
        raise HTTPException(400, "Ngày giao không được ở quá khứ")
    if body.time_window_end <= body.time_window_start:
        raise HTTPException(400, "Khung giờ không hợp lệ")

    customer = db.scalar(select(Customer).where(Customer.phone == body.phone))
    if customer is None:
        customer = Customer(name=body.customer_name, phone=body.phone)
        db.add(customer)
        db.flush()

    order = Order(
        customer_id=customer.id, address=body.address, lat=body.lat, lng=body.lng,
        delivery_date=body.delivery_date, time_window_start=body.time_window_start,
        time_window_end=body.time_window_end, payment_method=body.payment_method, note=body.note,
        status=OrderStatus.PENDING,
    )
    total = Decimal(0)
    for it in body.items:
        product = db.get(Product, it.product_id)
        if product is None or not product.active:
            raise HTTPException(400, f"Sản phẩm {it.product_id} không tồn tại")
        order.items.append(OrderItem(product_id=product.id, quantity=it.quantity, unit_price=product.price))
        total += product.price * it.quantity
    order.total = total
    db.add(order)
    db.flush()
    order.code = f"TV{order.id:06d}"
    db.commit()
    return to_out(db.scalar(_load(db).where(Order.id == order.id)))


@router.get("", response_model=list[OrderOut], dependencies=[Depends(require_staff)])
def list_orders(delivery_date: Optional[date] = Query(None), status: Optional[OrderStatus] = None,
                db: Session = Depends(get_db)):
    q = _load(db).order_by(Order.id.desc())
    if delivery_date:
        q = q.where(Order.delivery_date == delivery_date)
    if status:
        q = q.where(Order.status == status)
    return [to_out(o) for o in db.scalars(q).all()]


@router.patch("/{order_id}/status", response_model=OrderOut, dependencies=[Depends(require_staff)])
def update_status(order_id: int, body: StatusUpdate, db: Session = Depends(get_db)):
    order = db.scalar(_load(db).where(Order.id == order_id))
    if order is None:
        raise HTTPException(404, "Không tìm thấy đơn")
    new = OrderStatus(body.status)
    if new not in ALLOWED.get(order.status, set()):
        raise HTTPException(409, f"Không thể chuyển {order.status.value} → {new.value}")
    if new == OrderStatus.READY and (order.lat is None or order.lng is None):
        raise HTTPException(409, "Đơn chưa có toạ độ — cập nhật vị trí trước khi chuyển READY")
    order.status = new
    db.commit()
    return to_out(order)


@router.patch("/{order_id}/location", response_model=OrderOut, dependencies=[Depends(require_staff)])
def update_location(order_id: int, body: LocationUpdate, db: Session = Depends(get_db)):
    """Admin chỉnh toạ độ thủ công khi địa chỉ khách không định vị được (rủi ro R1)."""
    order = db.scalar(_load(db).where(Order.id == order_id))
    if order is None:
        raise HTTPException(404, "Không tìm thấy đơn")
    if order.stop is not None:
        raise HTTPException(409, "Đơn đã được xếp tuyến")
    order.lat, order.lng = body.lat, body.lng
    db.commit()
    return to_out(order)
