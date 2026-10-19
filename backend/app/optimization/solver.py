"""Optimization Engine — bài toán VRPTW
(Vehicle Routing Problem with Time Windows + Capacity).

Mục tiêu: tối thiểu  w_km * tổng km  +  w_time * tổng phút
Ràng buộc cứng: sức chứa xe (m3), khung giờ khách, giờ làm việc.

Hai bộ giải:
  * "ortools"   — Google OR-Tools (nếu đã cài `ortools`), chất lượng cao.
  * "heuristic" — Python thuần: chèn tham lam (cheapest insertion) + 2-opt.
                  Luôn chạy được, dùng làm phương án dự phòng.
Ngoài ra `baseline_plan` mô phỏng cách làm thủ công (giao theo thứ tự đặt
hàng) để đo KPI "giảm bao nhiêu % km".
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from .distance import build_matrices


# ---------------------------------------------------------------- dữ liệu vào
@dataclass
class Stop:
    order_id: int
    lat: float
    lng: float
    tw_start: int          # phút tính từ 00:00
    tw_end: int
    service_min: int       # thời gian dỡ hàng + lắp đặt
    volume_m3: float


@dataclass
class Vehicle:
    id: int
    capacity_m3: float
    driver_id: Optional[int] = None


@dataclass
class Depot:
    lat: float
    lng: float


# ---------------------------------------------------------------- kết quả
@dataclass
class PlannedStop:
    order_id: int
    sequence: int
    arrival_min: int       # phút tính từ 00:00 (đã tính chờ nếu đến sớm)


@dataclass
class RoutePlan:
    vehicle_id: int
    driver_id: Optional[int]
    stops: list[PlannedStop]
    total_km: float
    total_minutes: int


@dataclass
class OptimizationResult:
    routes: list[RoutePlan]
    unassigned: list[int] = field(default_factory=list)
    solver: str = "heuristic"
    total_km: float = 0.0
    baseline_km: Optional[float] = None

    @property
    def saving_percent(self) -> Optional[float]:
        if not self.baseline_km:
            return None
        return round((self.baseline_km - self.total_km) / self.baseline_km * 100, 1)


# ---------------------------------------------------------------- tiện ích
class _Problem:
    def __init__(self, depot: Depot, stops: list[Stop], vehicles: list[Vehicle],
                 day_start: int, day_end: int, road_factor: float, speed_kmh: float):
        self.depot, self.stops, self.vehicles = depot, stops, vehicles
        self.day_start, self.day_end = day_start, day_end
        pts = [(depot.lat, depot.lng)] + [(s.lat, s.lng) for s in stops]
        self.km, self.min = build_matrices(pts, road_factor, speed_kmh)

    # node 0 = kho, node i (1..n) = stops[i-1]
    def simulate(self, nodes: list[int], strict: bool = True) -> Optional[tuple[list[int], int, float]]:
        """Chạy thử một tuyến. Trả về (arrivals, end_time, km) hoặc None nếu vi phạm khung giờ."""
        t, prev, km, arrivals = self.day_start, 0, 0.0, []
        for node in nodes:
            s = self.stops[node - 1]
            t += self.min[prev][node]
            km += self.km[prev][node]
            if strict and t > s.tw_end:
                return None
            t = max(t, s.tw_start)           # đến sớm thì chờ
            arrivals.append(t)
            t += s.service_min
            prev = node
        t += self.min[prev][0]
        km += self.km[prev][0]
        if strict and t > self.day_end:
            return None
        return arrivals, t, km

    def cost(self, nodes: list[int], w_km: float, w_time: float) -> Optional[float]:
        sim = self.simulate(nodes)
        if sim is None:
            return None
        _, end, km = sim
        return w_km * km + w_time * (end - self.day_start)

    def load(self, nodes: list[int]) -> float:
        return sum(self.stops[n - 1].volume_m3 for n in nodes)

    def to_plans(self, routes: dict[int, list[int]]) -> list[RoutePlan]:
        plans = []
        for v in self.vehicles:
            nodes = routes.get(v.id, [])
            if not nodes:
                continue
            arrivals, end, km = self.simulate(nodes) or self.simulate(nodes, strict=False)  # type: ignore[misc]
            plans.append(RoutePlan(
                vehicle_id=v.id, driver_id=v.driver_id,
                stops=[PlannedStop(self.stops[n - 1].order_id, i + 1, arrivals[i])
                       for i, n in enumerate(nodes)],
                total_km=round(km, 2), total_minutes=end - self.day_start))
        return plans


# ---------------------------------------------------------------- heuristic
def _two_opt(p: _Problem, nodes: list[int], w_km: float, w_time: float) -> list[int]:
    best = nodes[:]
    best_cost = p.cost(best, w_km, w_time)
    improved = True
    while improved and best_cost is not None:
        improved = False
        for i in range(len(best) - 1):
            for j in range(i + 1, len(best)):
                cand = best[:i] + best[i:j + 1][::-1] + best[j + 1:]
                c = p.cost(cand, w_km, w_time)
                if c is not None and c < best_cost - 1e-9:
                    best, best_cost, improved = cand, c, True
    return best


def _solve_heuristic(p: _Problem, w_km: float, w_time: float):
    routes: dict[int, list[int]] = {v.id: [] for v in p.vehicles}
    # đơn có khung giờ hẹp / sớm được xếp trước
    pending = sorted(range(1, len(p.stops) + 1),
                     key=lambda n: (p.stops[n - 1].tw_end - p.stops[n - 1].tw_start,
                                    p.stops[n - 1].tw_end))
    unassigned: list[int] = []
    for node in pending:
        best = None  # (delta, vehicle_id, position)
        for v in p.vehicles:
            r = routes[v.id]
            if p.load(r) + p.stops[node - 1].volume_m3 > v.capacity_m3 + 1e-9:
                continue
            base = p.cost(r, w_km, w_time) if r else 0.0
            for pos in range(len(r) + 1):
                cand = r[:pos] + [node] + r[pos:]
                c = p.cost(cand, w_km, w_time)
                if c is None:
                    continue
                delta = c - base
                if best is None or delta < best[0]:
                    best = (delta, v.id, pos)
        if best is None:
            unassigned.append(p.stops[node - 1].order_id)
        else:
            _, vid, pos = best
            routes[vid].insert(pos, node)
    for vid in routes:
        if len(routes[vid]) > 2:
            routes[vid] = _two_opt(p, routes[vid], w_km, w_time)
    return routes, unassigned


# ---------------------------------------------------------------- OR-Tools
def _solve_ortools(p: _Problem, w_km: float, w_time: float, time_limit_s: int):
    from ortools.constraint_solver import pywrapcp, routing_enums_pb2  # type: ignore

    n_nodes = len(p.stops) + 1
    n_veh = len(p.vehicles)
    manager = pywrapcp.RoutingIndexManager(n_nodes, n_veh, 0)
    routing = pywrapcp.RoutingModel(manager)

    def arc_cost(i, j):
        a, b = manager.IndexToNode(i), manager.IndexToNode(j)
        return int(round(w_km * p.km[a][b] * 100 + w_time * p.min[a][b] * 100))

    cost_cb = routing.RegisterTransitCallback(arc_cost)
    routing.SetArcCostEvaluatorOfAllVehicles(cost_cb)

    def travel_plus_service(i, j):
        a, b = manager.IndexToNode(i), manager.IndexToNode(j)
        service = p.stops[a - 1].service_min if a > 0 else 0
        return p.min[a][b] + service

    time_cb = routing.RegisterTransitCallback(travel_plus_service)
    horizon = p.day_end
    routing.AddDimension(time_cb, 24 * 60, horizon, False, "Time")
    time_dim = routing.GetDimensionOrDie("Time")
    for node in range(1, n_nodes):
        s = p.stops[node - 1]
        time_dim.CumulVar(manager.NodeToIndex(node)).SetRange(s.tw_start, s.tw_end)
        # cho phép bỏ đơn (phạt lớn) thay vì vô nghiệm
        routing.AddDisjunction([manager.NodeToIndex(node)], 10_000_000)
    for v in range(n_veh):
        time_dim.CumulVar(routing.Start(v)).SetRange(p.day_start, p.day_start)
        time_dim.CumulVar(routing.End(v)).SetRange(p.day_start, p.day_end)

    def demand(i):
        node = manager.IndexToNode(i)
        return int(round(p.stops[node - 1].volume_m3 * 1000)) if node > 0 else 0

    dem_cb = routing.RegisterUnaryTransitCallback(demand)
    routing.AddDimensionWithVehicleCapacity(
        dem_cb, 0, [int(round(v.capacity_m3 * 1000)) for v in p.vehicles], True, "Capacity")

    params = pywrapcp.DefaultRoutingSearchParameters()
    params.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    params.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    params.time_limit.seconds = time_limit_s
    solution = routing.SolveWithParameters(params)
    if solution is None:
        return None

    routes: dict[int, list[int]] = {}
    visited = set()
    for v_idx, v in enumerate(p.vehicles):
        idx = routing.Start(v_idx)
        nodes = []
        while not routing.IsEnd(idx):
            node = manager.IndexToNode(idx)
            if node > 0:
                nodes.append(node)
                visited.add(node)
            idx = solution.Value(routing.NextVar(idx))
        routes[v.id] = nodes
    unassigned = [p.stops[n - 1].order_id for n in range(1, n_nodes) if n not in visited]
    return routes, unassigned


# ---------------------------------------------------------------- baseline
def baseline_km(depot: Depot, stops: list[Stop], vehicles: list[Vehicle],
                road_factor: float = 1.35, speed_kmh: float = 30.0) -> float:
    """Cách làm thủ công: chia đơn lần lượt cho từng xe theo thứ tự đặt hàng,
    giao đúng thứ tự đó (không xét khung giờ)."""
    p = _Problem(depot, stops, vehicles, 0, 10**9, road_factor, speed_kmh)
    total, v_idx, load, prev = 0.0, 0, 0.0, 0
    for node in range(1, len(stops) + 1):
        vol = stops[node - 1].volume_m3
        if load + vol > vehicles[v_idx].capacity_m3 and v_idx < len(vehicles) - 1:
            total += p.km[prev][0]
            v_idx, load, prev = v_idx + 1, 0.0, 0
        total += p.km[prev][node]
        load += vol
        prev = node
    total += p.km[prev][0]
    return round(total, 2)


# ---------------------------------------------------------------- API chính
def optimize(depot: Depot, stops: list[Stop], vehicles: list[Vehicle], *,
             day_start: int = 8 * 60, day_end: int = 18 * 60,
             w_km: float = 1.0, w_time: float = 0.5,
             road_factor: float = 1.35, speed_kmh: float = 30.0,
             use_ortools: bool = True, time_limit_s: int = 5) -> OptimizationResult:
    if not stops or not vehicles:
        return OptimizationResult(routes=[], unassigned=[s.order_id for s in stops])

    p = _Problem(depot, stops, vehicles, day_start, day_end, road_factor, speed_kmh)
    solved, solver_name = None, "heuristic"
    if use_ortools:
        try:
            solved = _solve_ortools(p, w_km, w_time, time_limit_s)
            solver_name = "ortools"
        except ImportError:
            solved = None
    if solved is None:
        solved, solver_name = _solve_heuristic(p, w_km, w_time), "heuristic"

    routes, unassigned = solved
    plans = p.to_plans(routes)
    total = round(sum(r.total_km for r in plans), 2)
    assigned = [s for s in stops if s.order_id not in set(unassigned)]
    return OptimizationResult(
        routes=plans, unassigned=unassigned, solver=solver_name, total_km=total,
        baseline_km=baseline_km(depot, assigned, vehicles, road_factor, speed_kmh) if assigned else None,
    )
