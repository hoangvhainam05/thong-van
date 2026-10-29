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
    if (strict && (time > this.dayEnd || time - this.dayStart > this.maxRouteMinutes)) return null;
    return { arrivals, end: time, km: distance };
  }

  cost(nodes: number[], weightKm: number, weightTime: number): number | null {
    const result = this.simulate(nodes);
    return result ? weightKm * result.km + weightTime * (result.end - this.dayStart) : null;
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
        totalMinutes: Math.ceil(result.end - this.dayStart),
      }];
    });
  }
}

function solveHeuristic(
  problem: Problem,
): { routes: Record<number, number[]>; unassigned: number[] } {
  const routes: Record<number, number[]> = Object.fromEntries(problem.vehicles.map((vehicle) => [vehicle.id, []]));
  const pending = new Set(Array.from({ length: problem.stops.length }, (_, index) => index + 1));
  while (pending.size) {
    let best: { node: number; vehicleId: number; distance: number; urgent: boolean } | null = null;
    for (const vehicle of problem.vehicles) {
      const route = routes[vehicle.id];
      const previous = route.length ? route[route.length - 1] : 0;
      for (const node of pending) {
        const stop = problem.stops[node - 1];
        if (problem.load(route) + stop.volumeM3 > vehicle.capacityM3 + 1e-9 ||
            problem.weight(route) + stop.weightKg > vehicle.capacityKg + 1e-9 ||
            !problem.simulate([...route, node])) continue;
        const urgent = Boolean(stop.urgent), distance = problem.km[previous][node];
        if (!best || (urgent && !best.urgent) || (urgent === best.urgent && distance < best.distance)) {
          best = { node, vehicleId: vehicle.id, distance, urgent };
        }
      }
    }
    if (!best) break;
    routes[best.vehicleId].push(best.node);
    pending.delete(best.node);
  }
  return { routes, unassigned: [...pending].map((node) => problem.stops[node - 1].orderId) };
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
