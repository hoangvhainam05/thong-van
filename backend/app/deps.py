from fastapi import Header, HTTPException

from .config import get_settings


def require_staff(x_staff_token: str = Header(default="")) -> None:
    """MVP: một token chung cho admin và nhân viên giao hàng.
    Giai đoạn sau thay bằng đăng nhập + phân quyền (JWT)."""
    if x_staff_token != get_settings().staff_token:
        raise HTTPException(status_code=401, detail="Sai hoặc thiếu X-Staff-Token")
