import os
from functools import lru_cache

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:  # python-dotenv là tuỳ chọn
    pass


class Settings:
    database_url: str = os.getenv(
        "DATABASE_URL", "mysql+pymysql://thongvan:thongvan@127.0.0.1:3306/thongvan?charset=utf8mb4"
    )
    staff_token: str = os.getenv("STAFF_TOKEN", "doi-token-nay")
    cors_origins: list[str] = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")

    # tham số tối ưu
    day_start: str = os.getenv("DELIVERY_DAY_START", "08:00")
    day_end: str = os.getenv("DELIVERY_DAY_END", "18:00")
    avg_speed_kmh: float = float(os.getenv("AVG_SPEED_KMH", "30"))
    road_factor: float = float(os.getenv("ROAD_FACTOR", "1.35"))
    weight_km: float = float(os.getenv("WEIGHT_KM", "1.0"))
    weight_time: float = float(os.getenv("WEIGHT_TIME", "0.5"))
    use_ortools: bool = os.getenv("USE_ORTOOLS", "true").lower() == "true"


@lru_cache
def get_settings() -> Settings:
    return Settings()


def hhmm_to_min(value: str) -> int:
    h, m = value.split(":")[:2]
    return int(h) * 60 + int(m)
