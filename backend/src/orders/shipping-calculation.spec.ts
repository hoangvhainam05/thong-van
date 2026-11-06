import { buildShippingBreakdown, distanceShippingFee, expressEligibility, ShippingRules, standardArrivalAt } from './shipping-calculation';

const rules: ShippingRules = {
  dayStart: '08:00', dayEnd: '18:00', expressCutoff: '16:00', expressMaxMinutes: 300,
  expressMaxDistanceKm: 10, expressMaxWeightKg: null,
  freeDistanceKm: 20, firstDistanceBandEndKm: 30, firstDistanceBandFee: 150000,
  nextDistanceStepKm: 10, nextDistanceStepFee: 50000,
  preparationMinutes: 10, handoverMinutes: 5,
  additionalDelayMinutes: 0, fallbackSpeedKmh: 25, rateVersion: 1,
};

function eligibleAt(acceptedAt: string, overrides: Partial<Parameters<typeof expressEligibility>[0]> = {}) {
  return expressEligibility({
    acceptedAt: new Date(acceptedAt), distanceKm: 10, volumeM3: 0.1, weightKg: 50,
    durationMinutes: 45, hasStock: true, hasVehicleCapacity: true, rules, ...overrides,
  });
}

describe('express delivery operating rules (Asia/Ho_Chi_Minh)', () => {
  test('accepts an express order at 08:00', () => expect(eligibleAt('2026-11-07T01:00:00Z').eligible).toBe(true));
  test('accepts an express order at 12:00', () => expect(eligibleAt('2026-11-07T05:00:00Z').eligible).toBe(true));
  test('accepts a feasible express order at 15:59', () => expect(eligibleAt('2026-11-07T08:59:00Z').eligible).toBe(true));
  test('rejects express orders at 16:00 and later', () => {
    expect(eligibleAt('2026-11-07T09:00:00Z').reasons.join(' ')).toContain('16:00');
    expect(eligibleAt('2026-11-07T09:30:00Z').eligible).toBe(false);
  });
  test('accepts arrival exactly at 18:00 when the 300-minute deadline is also met', () => {
    expect(eligibleAt('2026-11-07T06:00:00Z', { durationMinutes: 300 }).eligible).toBe(true);
  });
  test('rejects arrival after 18:00', () => {
    expect(eligibleAt('2026-11-07T06:01:00Z', { durationMinutes: 300 }).eligible).toBe(false);
  });
  test('accepts a 300-minute ETA and rejects 301 minutes', () => {
    expect(eligibleAt('2026-11-07T05:00:00Z', { durationMinutes: 300 }).eligible).toBe(true);
    expect(eligibleAt('2026-11-07T05:00:00Z', { durationMinutes: 301 }).reasons.join(' ')).toContain('300 phút');
  });
  test('accepts 10 km and rejects any distance above 10 km', () => {
    expect(eligibleAt('2026-11-07T05:00:00Z', { distanceKm: 10 }).eligible).toBe(true);
    expect(eligibleAt('2026-11-07T05:00:00Z', { distanceKm: 10.001 }).eligible).toBe(false);
  });
  test('volume does not impose an express delivery limit when a suitable vehicle is available', () => {
    expect(eligibleAt('2026-11-07T05:00:00Z', { volumeM3: 10 }).eligible).toBe(true);
  });
  test('enforces configured weight limits only when an admin sets one', () => {
    expect(eligibleAt('2026-11-07T05:00:00Z', { weightKg: 500 }).eligible).toBe(true);
    expect(eligibleAt('2026-11-07T05:00:00Z', { weightKg: 51, rules: { ...rules, expressMaxWeightKg: 50 } }).eligible).toBe(false);
  });
  test('rejects when stock or suitable vehicle capacity is unavailable', () => {
    expect(eligibleAt('2026-11-07T05:00:00Z', { hasStock: false }).eligible).toBe(false);
    expect(eligibleAt('2026-11-07T05:00:00Z', { hasVehicleCapacity: false }).eligible).toBe(false);
  });
});

describe('shipping price and standard ETA', () => {
  test('applies the configured actual-distance bands and keeps increasing above 30 km', () => {
    expect(distanceShippingFee(20, rules)).toBe(0);
    expect(distanceShippingFee(20.1, rules)).toBe(150000);
    expect(distanceShippingFee(30, rules)).toBe(150000);
    expect(distanceShippingFee(30.1, rules)).toBe(200000);
    expect(distanceShippingFee(40, rules)).toBe(200000);
    expect(distanceShippingFee(40.1, rules)).toBe(250000);
    const customized = {
      ...rules, freeDistanceKm: 5, firstDistanceBandEndKm: 8, firstDistanceBandFee: 120000,
      nextDistanceStepKm: 5, nextDistanceStepFee: 20000,
    };
    expect(distanceShippingFee(8, customized)).toBe(120000);
    expect(distanceShippingFee(9, customized)).toBe(140000);
  });
  test('charges only the distance band, including for express delivery', () => {
    const fee = buildShippingBreakdown({ distanceKm: 35, rules });
    expect(fee).toEqual({ distanceFee: 200000, totalFee: 200000 });
  });
  test('uses the distance threshold for free delivery regardless of order subtotal', () => {
    const free = buildShippingBreakdown({ distanceKm: 20, rules });
    const paid = buildShippingBreakdown({ distanceKm: 25, rules });
    expect(free.totalFee).toBe(0);
    expect(paid.totalFee).toBe(150000);
  });
  test('moves an ordinary ETA after shift end to the next 08:00 shift', () => {
    const arrival = standardArrivalAt(new Date('2026-11-07T10:00:00Z'), 60, rules); // 17:00 local + 60 min
    expect(arrival.toISOString()).toBe('2026-11-08T02:00:00.000Z'); // 08:00 next day + 60 min
  });
  test('starts ordinary processing at 08:00 when the order arrives before the shift', () => {
    const arrival = standardArrivalAt(new Date('2026-11-07T00:00:00Z'), 60, rules); // accepted 07:00 local
    expect(arrival.toISOString()).toBe('2026-11-07T02:00:00.000Z'); // 09:00 local
  });
});
