import { buildMatrices, LatLng, Matrices, subsetMatrices } from './distance';

export interface StopSpec {
  orderId: number;
  lat: number;
  lng: number;
  twStart: number;
  twEnd: number;
  serviceMin: number;
  volumeM3: number;
  weightKg: number;
  urgent?: boolean;
}

export interface VehicleSpec {
  id: number;
  capacityM3: number;
  capacityKg: number;
  driverId?: number | null;
}

export interface Depot {
  lat: number;
  lng: number;
}

export interface PlannedStop {
  orderId: number;
  sequence: number;
  arrivalMin: number;
}

export interface RoutePlan {
  vehicleId: number;
  driverId: number | null;
  stops: PlannedStop[];
  totalKm: number;
  totalMinutes: number;
}

export interface OptimizationResult {
  routes: RoutePlan[];
  unassigned: number[];
  solver: 'heuristic';
  totalKm: number;
  baselineKm: number | null;
  savingPercent: number | null;
}

class Problem {
  readonly km: number[][];
  readonly minutes: number[][];

  constructor(
    readonly depot: Depot,
    readonly stops: StopSpec[],
    readonly vehicles: VehicleSpec[],
    readonly dayStart: number,
    readonly dayEnd: number,
    readonly maxRouteMinutes: number,
    roadFactor: number,
    speedKmh: number,
    matrix?: Matrices,
  ) {
    const points: LatLng[] = [
      [depot.lat, depot.lng],
      ...stops.map((stop) => [stop.lat, stop.lng] as LatLng),
    ];
    ({ km: this.km, minutes: this.minutes } = matrix ?? buildMatrices(points, roadFactor, speedKmh));
  }

  simulate(nodes: number[], strict = true): { arrivals: number[]; end: number; km: number } | null {
    const hasMorningWindow = nodes.some((node) => this.stops[node - 1].twEnd <= 12 * 60);
    const hasAfternoonWindow = nodes.some((node) => this.stops[node - 1].twStart >= 12 * 60);
    // A route can serve all-day orders alongside either shift, but not both shifts.
    if (hasMorningWindow && hasAfternoonWindow) return null;
    const routeStart = this.routeStart(nodes, hasAfternoonWindow);
    let time = routeStart;
    let previous = 0;
    let distance = 0;
    const arrivals: number[] = [];
    for (const node of nodes) {
      const stop = this.stops[node - 1];
      time += this.minutes[previous][node];
      distance += this.km[previous][node];
      if (strict && time > stop.twEnd) return null;
      time = Math.max(time, stop.twStart);
      arrivals.push(time);
      time += stop.serviceMin;
      previous = node;
    }
    if (strict && (time > this.dayEnd || time - routeStart > this.maxRouteMinutes)) return null;
    return { arrivals, end: time, km: distance };
  }

  routeStart(nodes: number[], hasAfternoonWindow = nodes.some((node) => this.stops[node - 1].twStart >= 12 * 60)): number {
    return hasAfternoonWindow ? Math.max(this.dayStart, 12 * 60) : this.dayStart;
  }

  cost(nodes: number[], weightKm: number, weightTime: number): number | null {
    const result = this.simulate(nodes);
    return result ? weightKm * result.km + weightTime * (result.end - this.routeStart(nodes)) : null;
  }

  load(nodes: number[]): number {
    return nodes.reduce((sum, node) => sum + this.stops[node - 1].volumeM3, 0);
  }

  weight(nodes: number[]): number {
    return nodes.reduce((sum, node) => sum + this.stops[node - 1].weightKg, 0);
  }

  plans(routes: Record<number, number[]>): RoutePlan[] {
    return this.vehicles.flatMap((vehicle) => {
      const nodes = routes[vehicle.id] || [];
      if (!nodes.length) return [];
      const result = this.simulate(nodes) || this.simulate(nodes, false)!;
      return [{
        vehicleId: vehicle.id,
        driverId: vehicle.driverId ?? null,
        stops: nodes.map((node, index) => ({
          orderId: this.stops[node - 1].orderId,
          sequence: index + 1,
          arrivalMin: result.arrivals[index],
        })),
        totalKm: Number(result.km.toFixed(2)),
        totalMinutes: Math.ceil(result.end - this.routeStart(nodes)),
      }];
    });
  }
}

function solveHeuristic(problem: Problem): { routes: Record<number, number[]>; unassigned: number[] } {
  const routes: Record<number, number[]> = Object.fromEntries(problem.vehicles.map(v => [v.id, []]));
  const valid = (v: VehicleSpec, r: number[]) => problem.load(r) <= v.capacityM3 + 1e-9 && problem.weight(r) <= v.capacityKg + 1e-9 && problem.simulate(r) !== null;
  const km = (r: number[]) => r.length ? problem.simulate(r)!.km : 0;
  const order = problem.stops.map((_, i) => i + 1).sort((a, b) => Number(Boolean(problem.stops[b-1].urgent)) - Number(Boolean(problem.stops[a-1].urgent)) || problem.stops[a-1].twStart - problem.stops[b-1].twStart || problem.km[0][b] - problem.km[0][a] || a-b);
  const pending: number[] = [];
  for (const node of order) {
    let best: {id: number; route: number[]; delta: number; count: number} | undefined;
    for (const v of problem.vehicles) {
      const route = routes[v.id];
      for (let i = 0; i <= route.length; i++) {
        const candidate = [...route.slice(0,i), node, ...route.slice(i)];
        if (!valid(v,candidate)) continue;
        const delta = km(candidate) - km(route);
        // Keep nearby deliveries together on the same truck. Prefer a new truck
        // only when the current route cannot take the stop or adds more distance.
        if (!best || delta < best.delta - 1e-9 || (Math.abs(delta - best.delta) <= 1e-9 && route.length < best.count)) best = {id:v.id, route:candidate, delta, count:route.length};
      }
    }
    if (best) routes[best.id] = best.route; else pending.push(node);
  }
  const deadline = Date.now() + 20000;
  let improved = true;
  while (improved && Date.now() < deadline) {
    improved = false;
    outer: for (const v of problem.vehicles) for (const w of problem.vehicles) {
      const a = routes[v.id], b = routes[w.id];
      for (let i=0; i<a.length; i++) {
        for (let j=0; j<=b.length; j++) {
          if (v.id === w.id) {
            const next = a.filter((_, k) => k !== i); next.splice(j > i ? j-1 : j, 0, a[i]);
            if (valid(v,next) && km(next) < km(a)-1e-9) { routes[v.id]=next; improved=true; break outer; }
          } else {
            const x=a.filter((_,k)=>k!==i), y=[...b.slice(0,j),a[i],...b.slice(j)];
            if (valid(v,x) && valid(w,y) && (a.length > b.length + 1 || (a.length === b.length + 1 && km(x)+km(y)<km(a)+km(b)-1e-9))) { routes[v.id]=x; routes[w.id]=y; improved=true; break outer; }
          }
        }
        for (let j=0; j<b.length; j++) {
          if (v.id===w.id && j<=i) continue;
          if (v.id===w.id) {
            const swapped=[...a]; [swapped[i],swapped[j]]=[swapped[j],swapped[i]];
            const reversed=[...a.slice(0,i),...a.slice(i,j+1).reverse(),...a.slice(j+1)];
            for (const next of [swapped,reversed]) if (valid(v,next) && km(next)<km(a)-1e-9) { routes[v.id]=next; improved=true; break outer; }
          } else {
            const x=[...a], y=[...b]; [x[i],y[j]]=[y[j],x[i]];
            if (valid(v,x) && valid(w,y) && km(x)+km(y)<km(a)+km(b)-1e-9) { routes[v.id]=x; routes[w.id]=y; improved=true; break outer; }
          }
        }
      }
    }
  }
  return {routes, unassigned:pending.map(n=>problem.stops[n-1].orderId)};
}

export function baselineKm(
  depot: Depot,
  stops: StopSpec[],
  vehicles: VehicleSpec[],
  roadFactor = 1.35,
  speedKmh = 30,
  matrix?: Matrices,
): number {
  const problem = new Problem(depot, stops, vehicles, 0, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, roadFactor, speedKmh, matrix);
  let total = 0;
  let vehicleIndex = 0;
  let load = 0;
  let previous = 0;
  for (let node = 1; node <= stops.length; node += 1) {
    const volume = stops[node - 1].volumeM3;
    if (load + volume > vehicles[vehicleIndex].capacityM3 && vehicleIndex < vehicles.length - 1) {
      vehicleIndex += 1;
      load = 0;
      previous = 0;
    }
    total += problem.km[previous][node];
    load += volume;
    previous = node;
  }
  return Number(total.toFixed(2));
}

export function optimize(
  depot: Depot,
  stops: StopSpec[],
  vehicles: VehicleSpec[],
  options: {
    dayStart?: number;
    dayEnd?: number;
    weightKm?: number;
    weightTime?: number;
    roadFactor?: number;
    speedKmh?: number;
    maxRouteMinutes?: number;
    matrix?: Matrices;
  } = {},
): OptimizationResult {
  if (!stops.length || !vehicles.length) {
    return { routes: [], unassigned: stops.map((stop) => stop.orderId), solver: 'heuristic', totalKm: 0, baselineKm: null, savingPercent: null };
  }
  const dayStart = options.dayStart ?? 480;
  const dayEnd = options.dayEnd ?? 1080;
  const weightKm = options.weightKm ?? 1;
  const weightTime = options.weightTime ?? 0.5;
  const roadFactor = options.roadFactor ?? 1.35;
  const speedKmh = options.speedKmh ?? 30;
  const problem = new Problem(depot, stops, vehicles, dayStart, dayEnd, options.maxRouteMinutes ?? 480, roadFactor, speedKmh, options.matrix);
  const solved = solveHeuristic(problem);
  const routes = problem.plans(solved.routes);
  const totalKm = Number(routes.reduce((sum, route) => sum + route.totalKm, 0).toFixed(2));
  const unassignedSet = new Set(solved.unassigned);
  const assigned = stops.filter((stop) => !unassignedSet.has(stop.orderId));
  const assignedIndices = [0, ...stops.flatMap((stop, index) => unassignedSet.has(stop.orderId) ? [] : [index + 1])];
  const baseline = assigned.length ? baselineKm(depot, assigned, vehicles, roadFactor, speedKmh, subsetMatrices(problem, assignedIndices)) : null;
  return {
    routes,
    unassigned: solved.unassigned,
    solver: 'heuristic',
    totalKm,
    baselineKm: baseline,
    savingPercent: baseline ? Number((((baseline - totalKm) / baseline) * 100).toFixed(1)) : null,
  };
}

export function evaluateFixedRoute(
  depot: Depot,
  stops: StopSpec[],
  vehicle: VehicleSpec,
  options: { dayStart: number; dayEnd: number; roadFactor: number; speedKmh: number; maxRouteMinutes?: number; matrix?: Matrices },
): RoutePlan | null {
  const problem = new Problem(depot, stops, [vehicle], options.dayStart, options.dayEnd,
    options.maxRouteMinutes ?? 480, options.roadFactor, options.speedKmh, options.matrix);
  const nodes = stops.map((_, index) => index + 1);
  if (problem.load(nodes) > vehicle.capacityM3 + 1e-9 || problem.weight(nodes) > vehicle.capacityKg + 1e-9) return null;
  const result = problem.simulate(nodes);
  if (!result) return null;
  return {
    vehicleId: vehicle.id,
    driverId: vehicle.driverId ?? null,
    stops: stops.map((stop, index) => ({ orderId: stop.orderId, sequence: index + 1, arrivalMin: result.arrivals[index] })),
    totalKm: Number(result.km.toFixed(2)),
    totalMinutes: Math.ceil(result.end - options.dayStart),
  };
}
