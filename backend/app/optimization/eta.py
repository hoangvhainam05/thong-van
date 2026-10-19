"""Tính khung giờ ETA hiển thị cho khách.

MVP: ETA = giờ đến dự kiến của thuật toán, mở rộng thành khung giờ
(sớm hơn `before` phút, muộn hơn `after` phút) vì hàng điện máy có
thời gian lắp đặt khó đoán.

Giai đoạn sau (phần AI): thay `predict_delay_minutes` bằng mô hình học
máy huấn luyện từ dữ liệu delivery_stop (planned_arrival vs actual_arrival).
"""
from __future__ import annotations

from datetime import datetime, timedelta


def predict_delay_minutes(position: int) -> int:
    """Placeholder cho mô hình ML. Điểm càng xa trong tuyến, sai số càng lớn."""
    return 5 * max(0, position - 1)


def eta_window(planned: datetime, position: int, before: int = 15, after: int = 45) -> tuple[datetime, datetime]:
    delay = predict_delay_minutes(position)
    return planned - timedelta(minutes=before), planned + timedelta(minutes=after + delay)
