import { evaluateFixedRoute, optimize, StopSpec, VehicleSpec } from './solver';

const depot = { lat: 21.0285, lng: 105.8542 };
const vehicle: VehicleSpec = { id: 1, capacityM3: 1, capacityKg: 100, driverId: 1 };
const options = { dayStart: 480, dayEnd: 1080, roadFactor: 1.35, speedKmh: 30, maxRouteMinutes: 480 };
const stop = (orderId: number, changes: Partial<StopSpec> = {}): StopSpec => ({
  orderId, lat: 21.03, lng: 105.85, twStart: 480, twEnd: 1020,
  serviceMin: 10, volumeM3: 0.1, weightKg: 10, ...changes,
});

describe('Sprint 3 route constraints', () => {
  it('rejects a stop heavier than the vehicle capacity', () => {
    const result = optimize(depot, [stop(1, { weightKg: 120 })], [vehicle], options);
    expect(result.routes).toHaveLength(0);
    expect(result.unassigned).toEqual([1]);
  });

  it('rejects a route longer than an eight-hour shift', () => {
    expect(evaluateFixedRoute(depot, [stop(1, { serviceMin: 500 })], vehicle, options)).toBeNull();
    const result = optimize(depot, [stop(1, { serviceMin: 500 })], [vehicle], options);
    expect(result.unassigned).toEqual([1]);
  });

  it('gives an urgent order first claim on limited capacity', () => {
    const result = optimize(depot, [stop(1, { volumeM3: 0.7 }), stop(2, { volumeM3: 0.7, urgent: true })], [vehicle], options);
    expect(result.routes[0].stops.map((point) => point.orderId)).toEqual([2]);
    expect(result.unassigned).toEqual([1]);
  });
});

describe('supplied road matrix', () => {
  it('uses directional values for route, ETA and baseline even with an unassigned stop', () => {
    const stops = [stop(1), stop(2, { weightKg: 120 }), stop(3)];
    const matrix = {
      km: [[0, 2, 99, 8], [4, 0, 99, 3], [99, 99, 0, 99], [7, 6, 99, 0]],
      minutes: [[0, 2, 99, 8], [4, 0, 99, 3], [99, 99, 0, 99], [7, 6, 99, 0]],
    };
    const result = optimize(depot, stops, [vehicle], { ...options, matrix });
    expect(result.unassigned).toEqual([2]);
    expect(result.baselineKm).toBe(5);
    const plan = result.routes[0];
    expect(plan.totalKm).toBe(5);
    expect(plan.stops.map((s) => s.orderId)).toEqual([1, 3]);
    expect(plan.stops.map((s) => s.arrivalMin)).toEqual([482, 495]);
    const reversed = { km: [[0, 8, 2], [7, 0, 6], [4, 3, 0]], minutes: [[0, 8, 2], [7, 0, 6], [4, 3, 0]] };
    const fixed = evaluateFixedRoute(depot, [stops[2], stops[0]], vehicle, { ...options, matrix: reversed });
    expect(fixed?.totalKm).toBe(14);
    expect(fixed?.stops[0].arrivalMin).toBe(488);
  });
});

it('chooses the next feasible stop by directed road distance from the current point', () => {
  const matrix = {
    km: [[0, 12, 3, 7], [9, 0, 6, 2], [4, 8, 0, 1], [6, 2, 5, 0]],
    minutes: [[0, 12, 3, 7], [9, 0, 6, 2], [4, 8, 0, 1], [6, 2, 5, 0]],
  };
  const result = optimize(depot, [stop(1), stop(2), stop(3)], [vehicle], { ...options, matrix });
  expect(result.routes[0].stops.map((s) => s.orderId)).toEqual([2, 3, 1]);
  expect(result.routes[0].totalKm).toBe(6);
});

it('inserts a later considered stop before an existing stop when that saves distance', () => {
  const stops = [stop(1, { twStart: 480 }), stop(2, { twStart: 500 })];
  const matrix = {
    km: [[0, 1, 1], [10, 0, 20], [1, 1, 0]],
    minutes: [[0, 1, 1], [1, 0, 1], [1, 1, 0]],
  };
  const result = optimize(depot, stops, [vehicle], { ...options, matrix });
  expect(result.routes[0].stops.map(s => s.orderId)).toEqual([2, 1]);
  expect(result.routes[0].totalKm).toBe(2);
});


describe('balanced one-way delivery routes', () => {
  const vehicles = [vehicle, { ...vehicle, id: 2 }];
  it.each([[4, [2, 2]], [5, [2, 3]]])('balances %i orders across two vehicles', (count, expected) => {
    const result = optimize(depot, Array.from({ length: count }, (_, i) => stop(i + 1)), vehicles, options);
    expect(result.unassigned).toEqual([]);
    expect(result.routes.map(route => route.stops.length).sort()).toEqual(expected);
  });
  it('respects different vehicle capacities', () => {
    const result = optimize(depot, [stop(1, { weightKg: 60 }), stop(2, { weightKg: 60 }), stop(3, { weightKg: 60 })], [vehicle, { ...vehicle, id: 2, capacityKg: 200 }], options);
    expect(result.unassigned).toEqual([]);
    expect(result.routes.map(route => route.stops.length).sort()).toEqual([1, 2]);
  });
  it('does not count a return leg in distance or shift duration', () => {
    const matrix = { km: [[0, 3], [100, 0]], minutes: [[0, 5], [500, 0]] };
    const result = optimize(depot, [stop(1)], [vehicle], { ...options, matrix });
    expect(result.routes[0].totalKm).toBe(3);
    expect(result.routes[0].totalMinutes).toBe(15);
    expect(result.baselineKm).toBe(3);
  });
});
