// Optimization Engine (bản JavaScript cho giao diện demo).
// Cùng thuật toán với backend/app/optimization/solver.py (heuristic):
// chèn tham lam theo chi phí nhỏ nhất + 2-opt, có ràng buộc khung giờ và sức chứa xe.

export function haversineKm(a, b) {
  const R = 6371;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function matrices(points, roadFactor, speed) {
  const n = points.length;
  const km = Array.from({ length: n }, () => new Array(n).fill(0));
  const mins = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const d = haversineKm(points[i], points[j]) * roadFactor;
      km[i][j] = d;
      mins[i][j] = Math.max(1, Math.round((d / speed) * 60));
    }
  return { km, mins };
}

/**
 * @param depot {lat,lng}
 * @param stops [{id, lat, lng, twStart, twEnd, service, volume}]  (phút trong ngày)
 * @param vehicles [{id, capacity, driverId}]
 * @param opts {dayStart, dayEnd, wKm, wTime, roadFactor, speed}
 */
export function optimize(depot, stops, vehicles, opts = {}) {
  const o = { dayStart: 480, dayEnd: 1080, wKm: 1, wTime: 0.5, roadFactor: 1.35, speed: 30, ...opts };
  const t0 = typeof performance !== "undefined" ? performance.now() : 0;
  const points = [depot, ...stops];
  const { km, mins } = matrices(points, o.roadFactor, o.speed);

  const simulate = (nodes, strict = true) => {
    let t = o.dayStart, prev = 0, dist = 0;
    const arrivals = [];
    for (const n of nodes) {
      const s = stops[n - 1];
      t += mins[prev][n];
      dist += km[prev][n];
      if (strict && t > s.twEnd) return null;
      t = Math.max(t, s.twStart);
      arrivals.push(t);
      t += s.service;
      prev = n;
    }
    t += mins[prev][0];
    dist += km[prev][0];
    if (strict && t > o.dayEnd) return null;
    return { arrivals, end: t, km: dist };
  };
  const cost = (nodes) => {
    const r = simulate(nodes);
    return r ? o.wKm * r.km + o.wTime * (r.end - o.dayStart) : null;
  };
  const load = (nodes) => nodes.reduce((s, n) => s + stops[n - 1].volume, 0);

  const routes = Object.fromEntries(vehicles.map((v) => [v.id, []]));
  const pending = stops
    .map((_, i) => i + 1)
    .sort((a, b) => {
      const A = stops[a - 1], B = stops[b - 1];
      return A.twEnd - A.twStart - (B.twEnd - B.twStart) || A.twEnd - B.twEnd;
    });
  const unassigned = [];
  for (const node of pending) {
    let best = null;
    for (const v of vehicles) {
      const r = routes[v.id];
      if (load(r) + stops[node - 1].volume > v.capacity + 1e-9) continue;
      const base = r.length ? cost(r) : 0;
      for (let pos = 0; pos <= r.length; pos++) {
        const cand = [...r.slice(0, pos), node, ...r.slice(pos)];
        const c = cost(cand);
        if (c == null) continue;
        if (!best || c - base < best.delta) best = { delta: c - base, vid: v.id, pos };
      }
    }
    if (!best) unassigned.push(stops[node - 1].id);
    else routes[best.vid].splice(best.pos, 0, node);
  }

  // 2-opt cải thiện từng tuyến
  for (const vid of Object.keys(routes)) {
    let r = routes[vid];
    if (r.length < 3) continue;
    let bestCost = cost(r), improved = true;
    while (improved && bestCost != null) {
      improved = false;
      for (let i = 0; i < r.length - 1; i++)
        for (let j = i + 1; j < r.length; j++) {
          const cand = [...r.slice(0, i), ...r.slice(i, j + 1).reverse(), ...r.slice(j + 1)];
          const c = cost(cand);
          if (c != null && c < bestCost - 1e-9) {
            r = cand; bestCost = c; improved = true;
          }
        }
    }
    routes[vid] = r;
  }

  const plans = vehicles
    .filter((v) => routes[v.id].length)
    .map((v) => {
      const nodes = routes[v.id];
      const sim = simulate(nodes) || simulate(nodes, false);
      return {
        vehicleId: v.id,
        driverId: v.driverId ?? null,
        stops: nodes.map((n, i) => ({ orderId: stops[n - 1].id, seq: i + 1, arrival: sim.arrivals[i] })),
        totalKm: +sim.km.toFixed(1),
        totalMin: sim.end - o.dayStart,
        baselineKm: baselineKm(depot, nodes.map((n) => stops[n - 1]).sort((a, b) => a.order - b.order), o),
      };
    });

  const totalKm = +plans.reduce((s, p) => s + p.totalKm, 0).toFixed(1);
  const assigned = stops.filter((s) => !unassigned.includes(s.id));
  const baseline = assigned.length ? baselineFleetKm(depot, assigned, vehicles, o) : 0;
  return {
    plans,
    unassigned,
    totalKm,
    baselineKm: baseline,
    savingPercent: baseline ? +(((baseline - totalKm) / baseline) * 100).toFixed(1) : 0,
    ms: Math.round((typeof performance !== "undefined" ? performance.now() : 0) - t0),
  };
}

// Giao theo thứ tự đặt hàng, một xe
function baselineKm(depot, stopsInOrder, o) {
  let prev = depot, d = 0;
  for (const s of stopsInOrder) {
    d += haversineKm(prev, s) * o.roadFactor;
    prev = s;
  }
  d += haversineKm(prev, depot) * o.roadFactor;
  return +d.toFixed(1);
}

// Cách làm thủ công: chia lần lượt cho từng xe theo thứ tự đặt, đầy xe thì sang xe sau
function baselineFleetKm(depot, stops, vehicles, o) {
  const sorted = [...stops].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  let v = 0, loadV = 0, prev = depot, d = 0;
  for (const s of sorted) {
    if (loadV + s.volume > vehicles[v].capacity && v < vehicles.length - 1) {
      d += haversineKm(prev, depot) * o.roadFactor;
      v++; loadV = 0; prev = depot;
    }
    d += haversineKm(prev, s) * o.roadFactor;
    loadV += s.volume;
    prev = s;
  }
  d += haversineKm(prev, depot) * o.roadFactor;
  return +d.toFixed(1);
}

// Khung giờ ETA hiển thị cho khách
export function etaWindow(arrival, seq, before = 15, after = 45) {
  return { start: arrival - before, end: arrival + after + 5 * Math.max(0, seq - 1) };
}
