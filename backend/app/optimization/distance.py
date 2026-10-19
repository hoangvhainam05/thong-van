"""Ma trận khoảng cách / thời gian giữa các điểm.

MVP dùng công thức Haversine (đường chim bay) nhân hệ số đường bộ.
Khi tích hợp Map API (Google Maps / Goong / OSRM), chỉ cần viết một
provider mới trả về cùng định dạng và đổi DISTANCE_PROVIDER trong .env.
"""
from __future__ import annotations

import math
from typing import Sequence, Tuple

LatLng = Tuple[float, float]


def haversine_km(a: LatLng, b: LatLng) -> float:
    lat1, lng1 = map(math.radians, a)
    lat2, lng2 = map(math.radians, b)
    dlat, dlng = lat2 - lat1, lng2 - lng1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
    return 2 * 6371.0 * math.asin(math.sqrt(h))


def build_matrices(
    points: Sequence[LatLng],
    road_factor: float = 1.35,
    avg_speed_kmh: float = 30.0,
) -> tuple[list[list[float]], list[list[int]]]:
    """Trả về (km_matrix, minute_matrix). points[0] là kho."""
    n = len(points)
    km = [[0.0] * n for _ in range(n)]
    minutes = [[0] * n for _ in range(n)]
    for i in range(n):
        for j in range(n):
            if i == j:
                continue
            d = haversine_km(points[i], points[j]) * road_factor
            km[i][j] = d
            minutes[i][j] = max(1, round(d / avg_speed_kmh * 60))
    return km, minutes
