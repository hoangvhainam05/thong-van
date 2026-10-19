"""ORM ánh xạ đúng với database/schema.sql (schema.sql là nguồn chuẩn)."""
from __future__ import annotations

import enum
from datetime import date, datetime, time
from decimal import Decimal
from typing import Optional

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Numeric, String, Time, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class OrderStatus(str, enum.Enum):
    PENDING = "PENDING"                    # khách vừa đặt
    CONFIRMED = "CONFIRMED"                # nhân viên đã xác nhận
    READY = "READY"                        # hàng đã chuẩn bị, chờ xếp lịch
    SCHEDULED = "SCHEDULED"                # đã nằm trong một tuyến
    OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY"  # xe đã xuất kho
    DELIVERED = "DELIVERED"
    FAILED = "FAILED"                      # giao không thành công
    CANCELLED = "CANCELLED"


class RouteStatus(str, enum.Enum):
    DRAFT = "DRAFT"              # còn được tối ưu lại
    LOCKED = "LOCKED"            # đã chốt: thứ tự giao không đổi nữa
    IN_PROGRESS = "IN_PROGRESS"
    DONE = "DONE"


class Warehouse(Base):
    __tablename__ = "warehouse"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    address: Mapped[str] = mapped_column(String(255))
    lat: Mapped[Decimal] = mapped_column(Numeric(10, 7))
    lng: Mapped[Decimal] = mapped_column(Numeric(10, 7))


class Customer(Base):
    __tablename__ = "customer"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str] = mapped_column(String(20), unique=True)
    email: Mapped[Optional[str]] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Product(Base):
    __tablename__ = "product"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    category: Mapped[str] = mapped_column(String(60))
    price: Mapped[Decimal] = mapped_column(Numeric(12, 0))
    volume_m3: Mapped[Decimal] = mapped_column(Numeric(6, 3))
    weight_kg: Mapped[Decimal] = mapped_column(Numeric(7, 2))
    install_minutes: Mapped[int]
    image_url: Mapped[Optional[str]] = mapped_column(String(255))
    active: Mapped[bool] = mapped_column(default=True)


class Driver(Base):
    __tablename__ = "driver"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str] = mapped_column(String(20))
    active: Mapped[bool] = mapped_column(default=True)


class Vehicle(Base):
    __tablename__ = "vehicle"
    id: Mapped[int] = mapped_column(primary_key=True)
    plate: Mapped[str] = mapped_column(String(20), unique=True)
    capacity_m3: Mapped[Decimal] = mapped_column(Numeric(6, 2))
    capacity_kg: Mapped[Decimal] = mapped_column(Numeric(8, 2))
    active: Mapped[bool] = mapped_column(default=True)


class Order(Base):
    __tablename__ = "orders"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[Optional[str]] = mapped_column(String(20), unique=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customer.id"))
    address: Mapped[str] = mapped_column(String(255))
    lat: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 7))
    lng: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 7))
    delivery_date: Mapped[date] = mapped_column(Date)
    time_window_start: Mapped[time] = mapped_column(Time)
    time_window_end: Mapped[time] = mapped_column(Time)
    total: Mapped[Decimal] = mapped_column(Numeric(14, 0), default=0)
    payment_method: Mapped[str] = mapped_column(Enum("COD", "BANK_TRANSFER", name="payment_method"), default="COD")
    status: Mapped[OrderStatus] = mapped_column(
        Enum(OrderStatus, values_callable=lambda e: [m.value for m in e], name="order_status"),
        default=OrderStatus.PENDING,
    )
    note: Mapped[Optional[str]] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    customer: Mapped[Customer] = relationship()
    items: Mapped[list["OrderItem"]] = relationship(back_populates="order", cascade="all, delete-orphan")
    stop: Mapped[Optional["DeliveryStop"]] = relationship(back_populates="order", uselist=False)


class OrderItem(Base):
    __tablename__ = "order_item"
    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"))
    product_id: Mapped[int] = mapped_column(ForeignKey("product.id"))
    quantity: Mapped[int] = mapped_column(default=1)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 0))

    order: Mapped[Order] = relationship(back_populates="items")
    product: Mapped[Product] = relationship()


class Route(Base):
    __tablename__ = "route"
    id: Mapped[int] = mapped_column(primary_key=True)
    route_date: Mapped[date] = mapped_column(Date)
    warehouse_id: Mapped[int] = mapped_column(ForeignKey("warehouse.id"))
    driver_id: Mapped[Optional[int]] = mapped_column(ForeignKey("driver.id"))
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicle.id"))
    status: Mapped[RouteStatus] = mapped_column(
        Enum(RouteStatus, values_callable=lambda e: [m.value for m in e], name="route_status"),
        default=RouteStatus.DRAFT,
    )
    total_km: Mapped[Decimal] = mapped_column(Numeric(8, 2), default=0)
    total_minutes: Mapped[int] = mapped_column(default=0)
    baseline_km: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 2))
    solver: Mapped[str] = mapped_column(String(30), default="heuristic")
    locked_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    driver: Mapped[Optional[Driver]] = relationship()
    vehicle: Mapped[Vehicle] = relationship()
    stops: Mapped[list["DeliveryStop"]] = relationship(
        back_populates="route", order_by="DeliveryStop.sequence", cascade="all, delete-orphan"
    )


class DeliveryStop(Base):
    __tablename__ = "delivery_stop"
    id: Mapped[int] = mapped_column(primary_key=True)
    route_id: Mapped[int] = mapped_column(ForeignKey("route.id", ondelete="CASCADE"))
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), unique=True)
    sequence: Mapped[int]
    eta_start: Mapped[datetime] = mapped_column(DateTime)
    eta_end: Mapped[datetime] = mapped_column(DateTime)
    planned_arrival: Mapped[datetime] = mapped_column(DateTime)
    actual_arrival: Mapped[Optional[datetime]] = mapped_column(DateTime)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    route: Mapped[Route] = relationship(back_populates="stops")
    order: Mapped[Order] = relationship(back_populates="stop")
