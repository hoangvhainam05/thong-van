from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Product
from ..schemas import ProductOut

router = APIRouter(prefix="/api/products", tags=["Sản phẩm"])


@router.get("", response_model=list[ProductOut])
def list_products(db: Session = Depends(get_db)):
    return db.scalars(select(Product).where(Product.active.is_(True)).order_by(Product.category, Product.name)).all()
