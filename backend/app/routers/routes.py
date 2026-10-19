"""Xếp tuyến, chốt tuyến, giao hàng."""
from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..config import get_settings, hhmm_to_min
from ..database import get_db
from ..deps import require_staff
from ..models import (DeliveryStop, Driver, Order, OrderItem, OrderStatus, Route, RouteStatus,
                      Vehicle, Warehouse)
from ..optimization import Depot, Stop, optimize
from ..optimization import Vehicle as VehicleSpec
from ..optimization.eta import eta_window
from ..optimization.solver import baseline_km
from ..schemas import OptimizeRequest, OptimizeResponse, RouteOut, StopComplete, StopOut

router = APIRouter(prefix="/api", tags=["Tuyến giao hàng"], dependencies=[Depends(require_staff)])

UNLOAD_MINUTES = 10  # thời gian dỡ hàng cố định mỗi điểm, cộng thêm thời gian lắp đặt


def _route_query():
    return select(Route).options(
        selectinload(Route.driver), selectinload(Route.vehicle),
        selectinload(Route.stops).selectinload(DeliveryStop.order).selectinload(Order.customer),
    )


def route_out(r: Route) -> RouteOut:
    stops = []
    for s in r.stops:
        o = s.order
        stops.append(StopOut(
            stop_id=s.id, sequence=s.sequence, order_id=o.id, order_code=o.code or "",
            customer_name=o.customer.name, phone=o.customer.phone, address=o.address,
            lat=float(o.lat) if o.lat is not None else None, lng=float(o.lng) if o.lng is not None else None,
            time_window=f"{o.time_window_start:%H:%M}–{o.time_window_end:%H:%M}",
            planned_arrival=s.planned_arrival, eta_start=s.eta_start, eta_end=s.eta_end,
            order_status=o.status.value, completed_at=s.completed_at,
        ))
    return RouteOut(
        id=r.id, route_date=r.route_date, status=r.status.value, vehicle=r.vehicle.plate,
        driver_id=r.driver_id, driver_name=r.driver.name if r.driver else None,
        total_km=float(r.total_km), total_minutes=r.total_minutes,
        baseline_km=float(r.baseline_km) if r.baseline_km is not None else None,
        solver=r.solver, stops=stops,
    )


def _minutes(t) -> int:
    return t.hour * 60 + t.minute


@router.post("/routes/optimize", response_model=OptimizeResponse)
def optimize_routes(body: OptimizeRequest, db: Session = Depends(get_db)):
    cfg = get_settings()
    d = body.date
    warehouse = db.scalar(select(Warehouse).order_by(Warehouse.id))
    if warehouse is None:
        raise HTTPException(409, "Chưa khai báo kho")

    # 1) Huỷ các tuyến DRAFT cũ của ngày này -> đơn quay về READY để tối ưu lại.
    #    Tuyến LOCKED/IN_PROGRESS giữ nguyên (khách không bị tụt vị trí).
    for r in db.scalars(_route_query().where(Route.route_date == d, Route.status == RouteStatus.DRAFT)).all():
        for s in r.stops:
            s.order.status = OrderStatus.READY
        db.delete(r)
    db.flush()

    # 2) Gom đơn READY của ngày
    orders = db.scalars(
        select(Order).options(selectinload(Order.items).selectinload(OrderItem.product))
        .where(Order.delivery_date == d, Order.status == OrderStatus.READY, ~Order.stop.has())
        .order_by(Order.id)
    ).all()
    missing = [o.code for o in orders if o.lat is None or o.lng is None]
    orders = [o for o in orders if o.lat is not None and o.lng is not None]

    # 3) Xe & tài xế còn rảnh trong ngày
    busy = db.scalars(select(Route).where(Route.route_date == d)).all()
    busy_vehicles = {r.vehicle_id for r in busy}
    busy_drivers = {r.driver_id for r in busy if r.driver_id}
    vehicles = [v for v in db.scalars(select(Vehicle).where(Vehicle.active.is_(True)).order_by(Vehicle.id)).all()
                if v.id not in busy_vehicles]
    drivers = [x for x in db.scalars(select(Driver).where(Driver.active.is_(True)).order_by(Driver.id)).all()
               if x.id not in busy_drivers]
    if not vehicles:
        raise HTTPException(409, "Không còn xe trống cho ngày này")

    specs = [VehicleSpec(v.id, float(v.capacity_m3), drivers[i].id if i < len(drivers) else None)
             for i, v in enumerate(vehicles)]
    stops = [Stop(
        order_id=o.id, lat=float(o.lat), lng=float(o.lng),
        tw_start=_minutes(o.time_window_start), tw_end=_minutes(o.time_window_end),
        service_min=UNLOAD_MINUTES + sum(i.product.install_minutes * i.quantity for i in o.items),
        volume_m3=sum(float(i.product.volume_m3) * i.quantity for i in o.items),
    ) for o in orders]
    depot = Depot(float(warehouse.lat), float(warehouse.lng))

    result = optimize(
        depot, stops, specs,
        day_start=hhmm_to_min(cfg.day_start), day_end=hhmm_to_min(cfg.day_end),
        w_km=cfg.weight_km, w_time=cfg.weight_time, road_factor=cfg.road_factor,
        speed_kmh=cfg.avg_speed_kmh, use_ortools=cfg.use_ortools,
    )

    # 4) Lưu tuyến + điểm dừng trong một transaction
    by_id = {o.id: o for o in orders}
    stop_spec = {s.order_id: s for s in stops}
    midnight = datetime.combine(d, datetime.min.time())
    created: list[Route] = []
    for plan in result.routes:
        own = [stop_spec[ps.order_id] for ps in sorted(plan.stops, key=lambda x: x.order_id)]
        route = Route(
            route_date=d, warehouse_id=warehouse.id, driver_id=plan.driver_id, vehicle_id=plan.vehicle_id,
            status=RouteStatus.DRAFT, total_km=plan.total_km, total_minutes=plan.total_minutes,
            baseline_km=baseline_km(depot, own, [VehicleSpec(plan.vehicle_id, 1e9)],
                                    cfg.road_factor, cfg.avg_speed_kmh),
            solver=result.solver,
        )
        for ps in plan.stops:
            planned = midnight + timedelta(minutes=ps.arrival_min)
            start, end = eta_window(planned, ps.sequence)
            route.stops.append(DeliveryStop(order_id=ps.order_id, sequence=ps.sequence,
                                            planned_arrival=planned, eta_start=start, eta_end=end))
            by_id[ps.order_id].status = OrderStatus.SCHEDULED
        db.add(route)
        created.append(route)
    db.commit()

    ids = [r.id for r in created]
    routes = db.scalars(_route_query().where(Route.id.in_(ids)).order_by(Route.id)).all() if ids else []
    return OptimizeResponse(
        routes=[route_out(r) for r in routes],
        unassigned_order_codes=[by_id[i].code for i in result.unassigned],
        missing_location_codes=missing,
        total_km=result.total_km, baseline_km=result.baseline_km,
        saving_percent=result.saving_percent, solver=result.solver,
    )


@router.get("/routes", response_model=list[RouteOut])
def list_routes(route_date: date = Query(...), driver_id: Optional[int] = None, db: Session = Depends(get_db)):
    q = _route_query().where(Route.route_date == route_date).order_by(Route.id)
    if driver_id is not None:
        q = q.where(Route.driver_id == driver_id, Route.status != RouteStatus.DRAFT)
    return [route_out(r) for r in db.scalars(q).all()]


def _get_route(db: Session, route_id: int) -> Route:
    r = db.scalar(_route_query().where(Route.id == route_id))
    if r is None:
        raise HTTPException(404, "Không tìm thấy tuyến")
    return r


@router.post("/routes/{route_id}/lock", response_model=RouteOut)
def lock_route(route_id: int, db: Session = Depends(get_db)):
    """Quản lý duyệt tuyến. Sau khi chốt, thứ tự giao không bị tối ưu lại nữa."""
    r = _get_route(db, route_id)
    if r.status != RouteStatus.DRAFT:
        raise HTTPException(409, "Chỉ chốt được tuyến DRAFT")
    if r.driver_id is None:
        raise HTTPException(409, "Tuyến chưa có tài xế")
    r.status, r.locked_at = RouteStatus.LOCKED, datetime.now()
    db.commit()
    return route_out(r)


@router.post("/routes/{route_id}/start", response_model=RouteOut)
def start_route(route_id: int, db: Session = Depends(get_db)):
    r = _get_route(db, route_id)
    if r.status != RouteStatus.LOCKED:
        raise HTTPException(409, "Tuyến phải được chốt trước khi xuất kho")
    r.status = RouteStatus.IN_PROGRESS
    for s in r.stops:
        s.order.status = OrderStatus.OUT_FOR_DELIVERY
    db.commit()
    return route_out(r)


def _get_stop(db: Session, stop_id: int) -> DeliveryStop:
    s = db.get(DeliveryStop, stop_id)
    if s is None:
        raise HTTPException(404, "Không tìm thấy điểm dừng")
    if s.route.status != RouteStatus.IN_PROGRESS:
        raise HTTPException(409, "Tuyến chưa xuất kho")
    return s


@router.post("/stops/{stop_id}/arrive", response_model=RouteOut)
def arrive(stop_id: int, db: Session = Depends(get_db)):
    s = _get_stop(db, stop_id)
    s.actual_arrival = s.actual_arrival or datetime.now()
    db.commit()
    return route_out(_get_route(db, s.route_id))


@router.post("/stops/{stop_id}/complete", response_model=RouteOut)
def complete(stop_id: int, body: StopComplete, db: Session = Depends(get_db)):
    s = _get_stop(db, stop_id)
    if s.completed_at is not None:
        raise HTTPException(409, "Điểm này đã hoàn tất")
    now = datetime.now()
    s.actual_arrival = s.actual_arrival or now
    s.completed_at = now
    s.order.status = OrderStatus.DELIVERED if body.success else OrderStatus.FAILED
    if body.note:
        s.order.note = body.note[:255]
    route = s.route
    if all(x.completed_at is not None for x in route.stops):
        route.status = RouteStatus.DONE
    db.commit()
    return route_out(_get_route(db, s.route_id))
