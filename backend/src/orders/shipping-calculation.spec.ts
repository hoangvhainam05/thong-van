import { buildShippingBreakdown, expressEligibility, ShippingRules, standardArrivalAt, volumeFee } from './shipping-calculation';

const rules: ShippingRules = {
  dayStart: '08:00', dayEnd: '18:00', expressCutoff: '16:00', expressMaxMinutes: 300,
  expressMaxDistanceKm: 10, expressMaxVolumeM3: 0.1, expressMaxWeightKg: null,
  baseDistanceKm: 2, baseFee: 15000, perKmFee: 5000, expressFee: 10000,
  roundingIncrement: 1000,
  volumeTiers: [
    { max_m3: 0.02, fee: 0 }, { max_m3: 0.05, fee: 5000 },
    { max_m3: 0.1, fee: 10000 }, { max_m3: 0.15, fee: 20000 },
  ],
  weightFeePerKg: null, preparationMinutes: 10, handoverMinutes: 5,
  additionalDelayMinutes: 0, fallbackSpeedKmh: 25, freeShipFrom: 5_000_000, rateVersion: 1,
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
  test('accepts 0.10 m³ and rejects volume above the configured limit', () => {
    expect(eligibleAt('2026-11-07T05:00:00Z', { volumeM3: 0.1 }).eligible).toBe(true);
    expect(eligibleAt('2026-11-07T05:00:00Z', { volumeM3: 0.1001 }).eligible).toBe(false);
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
  test('uses each volume fee band and requests a custom quote above 0.15 m³', () => {
    expect(volumeFee(0.02, rules.volumeTiers)).toBe(0);
    expect(volumeFee(0.05, rules.volumeTiers)).toBe(5000);
    expect(volumeFee(0.1, rules.volumeTiers)).toBe(10000);
    expect(volumeFee(0.15, rules.volumeTiers)).toBe(20000);
    expect(volumeFee(0.1501, rules.volumeTiers)).toBeNull();
  });
  test('computes distance, packaging, express and configured weight charges with rounding', () => {
    const fee = buildShippingBreakdown({ distanceKm: 8, volumeM3: 0.03, weightKg: 12, subtotal: 100000, deliveryType: 'EXPRESS', rules });
    expect(fee).toEqual({ distanceFee: 45000, volumeFee: 5000, weightFee: 0, expressFee: 10000, discount: 0, totalFee: 60000 });
    const weightFee = buildShippingBreakdown({ distanceKm: 2, volumeM3: 0.01, weightKg: 12, subtotal: 100000, deliveryType: 'STANDARD', rules: { ...rules, weightFeePerKg: 1000, roundingIncrement: 5000 } });
    expect(weightFee.weightFee).toBe(12000);
    expect(weightFee.totalFee % 5000).toBe(0);
  });
  test('keeps totals non-negative and applies configured free-shipping discount', () => {
    const result = buildShippingBreakdown({ distanceKm: 2, volumeM3: 0.01, weightKg: 1, subtotal: 5_000_000, deliveryType: 'STANDARD', rules });
    expect(result.discount).toBe(15000);
    expect(result.totalFee).toBe(0);
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
