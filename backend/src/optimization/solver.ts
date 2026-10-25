import { buildMatrices, LatLng } from './distance';

export interface StopSpec {
  orderId: number;
  lat: number;
  lng: number;
  twStart: number;
  twEnd: number;
  serviceMin: number;
  volumeM3: number;
}

export interface VehicleSpec {
  id: number;
  capacityM3: number;
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
    roadFactor: number,
    speedKmh: number,
  ) {
    const points: LatLng[] = [
      [depot.lat, depot.lng],
      ...stops.map((stop) => [stop.lat, stop.lng] as LatLng),
    ];
    ({ km: this.km, minutes: this.minutes } = buildMatrices(points, roadFactor, speedKmh));
  }

  simulate(nodes: number[], strict = true): { arrivals: number[]; end: number; km: number } | null {
    let time = this.dayStart;
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
    time += this.minutes[previous][0];
    distance += this.km[previous][0];
    if (strict && time > this.dayEnd) return null;
    return { arrivals, end: time, km: distance };
  }

  cost(nodes: number[], weightKm: number, weightTime: number): number | null {
    const result = this.simulate(nodes);
    return result ? weightKm * result.km + weightTime * (result.end - this.dayStart) : null;
  }

  load(nodes: number[]): number {
    return nodes.reduce((sum, node) => sum + this.stops[node - 1].volumeM3, 0);
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
        totalMinutes: result.end - this.dayStart,
      }];
    });
  }
}

function twoOpt(problem: Problem, initial: number[], weightKm: number, weightTime: number): number[] {
  let best = [...initial];
  let bestCost = problem.cost(best, weightKm, weightTime);
  let improved = true;
  while (improved && bestCost !== null) {
    improved = false;
    for (let i = 0; i < best.length - 1; i += 1) {
      for (let j = i + 1; j < best.length; j += 1) {
        const candidate = [
          ...best.slice(0, i),
          ...best.slice(i, j + 1).reverse(),
          ...best.slice(j + 1),
        ];
        const cost = problem.cost(candidate, weightKm, weightTime);
        if (cost !== null && cost < bestCost - 1e-9) {
          best = candidate;
          bestCost = cost;
          improved = true;
        }
      }
    }
  }
  return best;
}

function solveHeuristic(
  problem: Problem,
  weightKm: number,
  weightTime: number,
): { routes: Record<number, number[]>; unassigned: number[] } {
  const routes: Record<number, number[]> = Object.fromEntries(
    problem.vehicles.map((vehicle) => [vehicle.id, []]),
  );
  const pending = Array.from({ length: problem.stops.length }, (_, index) => index + 1)
    .sort((a, b) => {
      const first = problem.stops[a - 1];
      const second = problem.stops[b - 1];
      return (first.twEnd - first.twStart) - (second.twEnd - second.twStart)
        || first.twEnd - second.twEnd;
    });
  const unassigned: number[] = [];

  for (const node of pending) {
    let best: { delta: number; vehicleId: number; position: number } | null = null;
    for (const vehicle of problem.vehicles) {
      const route = routes[vehicle.id];
      const stop = problem.stops[node - 1];
      if (problem.load(route) + stop.volumeM3 > vehicle.capacityM3 + 1e-9) continue;
      const base = route.length ? problem.cost(route, weightKm, weightTime) : 0;
      for (let position = 0; position <= route.length; position += 1) {
        const candidate = [...route.slice(0, position), node, ...route.slice(position)];
        const cost = problem.cost(candidate, weightKm, weightTime);
        if (cost === null) continue;
        const delta = cost - base!;
        if (!best || delta < best.delta) best = { delta, vehicleId: vehicle.id, position };
      }
    }
    if (!best) unassigned.push(problem.stops[node - 1].orderId);
    else routes[best.vehicleId].splice(best.position, 0, node);
  }

  for (const vehicle of problem.vehicles) {
    if (routes[vehicle.id].length > 2) {
      routes[vehicle.id] = twoOpt(problem, routes[vehicle.id], weightKm, weightTime);
    }
  }
  return { routes, unassigned };
}

export function baselineKm(
  depot: Depot,
  stops: StopSpec[],
  vehicles: VehicleSpec[],
  roadFactor = 1.35,
  speedKmh = 30,
): number {
  const problem = new Problem(depot, stops, vehicles, 0, Number.MAX_SAFE_INTEGER, roadFactor, speedKmh);
  let total = 0;
  let vehicleIndex = 0;
  let load = 0;
  let previous = 0;
  for (let node = 1; node <= stops.length; node += 1) {
    const volume = stops[node - 1].volumeM3;
    if (load + volume > vehicles[vehicleIndex].capacityM3 && vehicleIndex < vehicles.length - 1) {
      total += problem.km[previous][0];
      vehicleIndex += 1;
      load = 0;
      previous = 0;
    }
    total += problem.km[previous][node];
    load += volume;
    previous = node;
  }
  total += problem.km[previous][0];
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
  const problem = new Problem(depot, stops, vehicles, dayStart, dayEnd, roadFactor, speedKmh);
  const solved = solveHeuristic(problem, weightKm, weightTime);
  const routes = problem.plans(solved.routes);
  const totalKm = Number(routes.reduce((sum, route) => sum + route.totalKm, 0).toFixed(2));
  const unassignedSet = new Set(solved.unassigned);
  const assigned = stops.filter((stop) => !unassignedSet.has(stop.orderId));
  const baseline = assigned.length ? baselineKm(depot, assigned, vehicles, roadFactor, speedKmh) : null;
  return {
    routes,
    unassigned: solved.unassigned,
    solver: 'heuristic',
    totalKm,
    baselineKm: baseline,
    savingPercent: baseline ? Number((((baseline - totalKm) / baseline) * 100).toFixed(1)) : null,
  };
}
