from __future__ import annotations

from datetime import date, datetime, time
from typing import Literal, Optional

from pydantic import BaseModel, Field


class ProductOut(BaseModel):
    id: int
    name: str
    category: str
    price: float
    volume_m3: float
    install_minutes: int
    image_url: Optional[str] = None

    model_config = {"from_attributes": True}


class OrderItemIn(BaseModel):
    product_id: int
    quantity: int = Field(1, ge=1, le=20)


class OrderCreate(BaseModel):
    customer_name: str = Field(min_length=2, max_length=120)
    phone: str = Field(pattern=r"^0\d{9,10}$")
    address: str = Field(min_length=5, max_length=255)
    lat: Optional[float] = Field(None, ge=-90, le=90)
    lng: Optional[float] = Field(None, ge=-180, le=180)
    delivery_date: date
    time_window_start: time = time(8, 0)
    time_window_end: time = time(17, 0)
    payment_method: Literal["COD", "BANK_TRANSFER"] = "COD"
    note: Optional[str] = Field(None, max_length=255)
    items: list[OrderItemIn] = Field(min_length=1)


class OrderItemOut(BaseModel):
    product_name: str
    quantity: int
    unit_price: float


class OrderOut(BaseModel):
    id: int
    code: str
    customer_name: str
    phone: str
    address: str
    lat: Optional[float]
    lng: Optional[float]
    delivery_date: date
    time_window_start: time
    time_window_end: time
    total: float
    payment_method: str
    status: str
    items: list[OrderItemOut]
    route_id: Optional[int] = None
    sequence: Optional[int] = None


class StatusUpdate(BaseModel):
    status: Literal["CONFIRMED", "READY", "CANCELLED"]


class LocationUpdate(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


class OptimizeRequest(BaseModel):
    date: date


class StopOut(BaseModel):
    stop_id: int
    sequence: int
    order_id: int
    order_code: str
    customer_name: str
    phone: str
    address: str
    lat: Optional[float]
    lng: Optional[float]
    time_window: str
    planned_arrival: datetime
    eta_start: datetime
    eta_end: datetime
    order_status: str
    completed_at: Optional[datetime]


class RouteOut(BaseModel):
    id: int
    route_date: date
    status: str
    vehicle: str
    driver_id: Optional[int]
    driver_name: Optional[str]
    total_km: float
    total_minutes: int
    baseline_km: Optional[float]
    solver: str
    stops: list[StopOut]


class OptimizeResponse(BaseModel):
    routes: list[RouteOut]
    unassigned_order_codes: list[str]
    missing_location_codes: list[str]
    total_km: float
    baseline_km: Optional[float]
    saving_percent: Optional[float]
    solver: str


class StopComplete(BaseModel):
    success: bool = True
    note: Optional[str] = None


class TrackingOut(BaseModel):
    code: str
    status: str
    status_label: str
    timeline: list[dict]
    delivery_date: date
    time_window: str
    # "còn N đơn trước bạn" — chỉ có số, không lộ thông tin đơn khác
    position: Optional[int] = None
    total_stops: Optional[int] = None
    stops_before: Optional[int] = None
    route_locked: bool = False
    eta_start: Optional[datetime] = None
    eta_end: Optional[datetime] = None
    message: str
