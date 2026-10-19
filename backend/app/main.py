from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import get_settings
from .database import get_db
from .deps import require_staff
from .models import Driver, Vehicle
from .routers import orders, products, routes, tracking

app = FastAPI(
    title="Thông Vân — Order & Delivery Optimization API",
    description="Hệ thống quản lý đơn hàng và tối ưu hoá giao hàng thông minh",
    version="0.1.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(products.router)
app.include_router(orders.router)
app.include_router(routes.router)
app.include_router(tracking.router)


@app.get("/api/health", tags=["Hệ thống"])
def health():
    return {"status": "ok"}


@app.get("/api/drivers", tags=["Hệ thống"], dependencies=[Depends(require_staff)])
def list_drivers(db: Session = Depends(get_db)):
    return [{"id": d.id, "name": d.name} for d in db.scalars(select(Driver).where(Driver.active.is_(True)))]


@app.get("/api/vehicles", tags=["Hệ thống"], dependencies=[Depends(require_staff)])
def list_vehicles(db: Session = Depends(get_db)):
    return [{"id": v.id, "plate": v.plate, "capacity_m3": float(v.capacity_m3)}
            for v in db.scalars(select(Vehicle).where(Vehicle.active.is_(True)))]
