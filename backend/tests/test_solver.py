"""Kiểm thử Optimization Engine. Chạy: `pytest` hoặc `python -m tests.test_solver`."""
from app.optimization.solver import Depot, Stop, Vehicle, optimize

DEPOT = Depot(21.0285, 105.8542)


def _stops():
    data = [  # (id, lat, lng, tw_start, tw_end, service, volume)
        (1, 21.0450, 105.8000, 480, 720, 20, 0.45),
        (2, 21.0120, 105.8700, 480, 1020, 10, 0.85),
        (3, 21.0600, 105.8300, 780, 1020, 75, 0.30),
        (4, 20.9900, 105.8100, 480, 1020, 20, 0.25),
        (5, 21.0350, 105.9000, 480, 720, 15, 0.40),
        (6, 20.9700, 105.8600, 480, 1020, 15, 1.40),
        (7, 21.0800, 105.8700, 480, 1020, 90, 0.35),
        (8, 21.0200, 105.7800, 840, 1020, 45, 0.12),
    ]
    return [Stop(*row) for row in data]


def _check(result, stops, vehicles):
    by_id = {s.order_id: s for s in stops}
    cap = {v.id: v.capacity_m3 for v in vehicles}
    seen = []
    for r in result.routes:
        assert sum(by_id[st.order_id].volume_m3 for st in r.stops) <= cap[r.vehicle_id] + 1e-9
        for st in r.stops:
            s = by_id[st.order_id]
            assert s.tw_start <= st.arrival_min <= s.tw_end, (st, s)
            seen.append(st.order_id)
        assert [st.sequence for st in r.stops] == list(range(1, len(r.stops) + 1))
    assert sorted(seen + result.unassigned) == sorted(by_id)


def test_heuristic_respects_constraints():
    stops = _stops()
    vehicles = [Vehicle(1, 3.5, 1), Vehicle(2, 3.5, 2)]
    res = optimize(DEPOT, stops, vehicles, use_ortools=False)
    assert res.solver == "heuristic"
    assert not res.unassigned
    _check(res, stops, vehicles)


def test_capacity_forces_split_or_unassigned():
    stops = _stops()
    vehicles = [Vehicle(1, 1.5)]
    res = optimize(DEPOT, stops, vehicles, use_ortools=False)
    _check(res, stops, vehicles)
    assert res.unassigned  # tổng 4.12 m3 > 1.5 m3


def test_optimized_not_worse_than_baseline():
    stops = _stops()
    vehicles = [Vehicle(1, 3.5), Vehicle(2, 3.5)]
    res = optimize(DEPOT, stops, vehicles, use_ortools=False, w_time=0)
    assert res.baseline_km is not None
    assert res.total_km <= res.baseline_km * 1.05


if __name__ == "__main__":
    stops = _stops()
    vehicles = [Vehicle(1, 3.5, 1), Vehicle(2, 3.5, 2)]
    res = optimize(DEPOT, stops, vehicles)
    print(f"Bộ giải: {res.solver} | Tổng km: {res.total_km} | Thủ công: {res.baseline_km} "
          f"| Tiết kiệm: {res.saving_percent}%")
    for r in res.routes:
        seq = " → ".join(f"#{s.order_id}({s.arrival_min // 60:02d}:{s.arrival_min % 60:02d})" for s in r.stops)
        print(f"  Xe {r.vehicle_id}: Kho → {seq} → Kho  [{r.total_km} km, {r.total_minutes} phút]")
    test_heuristic_respects_constraints()
    test_capacity_forces_split_or_unassigned()
    test_optimized_not_worse_than_baseline()
    print("Tất cả kiểm thử: OK")
