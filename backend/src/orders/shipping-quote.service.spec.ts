import { ShippingQuoteService } from './shipping-quote.service';

function product(overrides: Record<string, unknown> = {}) {
  return {
    id: 1, name: 'Tủ lạnh', active: true, stock: 10, price: '1000000',
    volumeM3: '0.03', weightKg: '10',
    packageLengthCm: '30', packageWidthCm: '40', packageHeightCm: '25', packageWeightKg: '10',
    ...overrides,
  } as any;
}

function setup(products = [product()], route: { distanceKm: number; travelMinutes: number | null } = { distanceKm: 8, travelMinutes: 45 }) {
  const productRepo = { find: jest.fn(async () => products) };
  const warehouseRepo = { find: jest.fn(async () => [{ id: 7, lat: '10.8', lng: '106.6' }]) };
  const vehicleRepo = { find: jest.fn(async () => [{ capacityM3: '5', capacityKg: '1000', active: true }]) };
  const settingsRepo = { findOne: jest.fn(async () => null) };
  const roadMatrix = { getDrivingRoute: jest.fn(async () => route) };
  const service = new ShippingQuoteService(productRepo as any, warehouseRepo as any, vehicleRepo as any, settingsRepo as any, roadMatrix as any);
  return { service, productRepo, warehouseRepo, vehicleRepo, settingsRepo, roadMatrix };
}

const input = { lat: 10.9, lng: 106.7, delivery_type: 'EXPRESS' as const, items: [{ product_id: 1, quantity: 1 }] };

describe('ShippingQuoteService', () => {
  test('calculates a server quote from the road route and configured package dimensions', async () => {
    const { service } = setup();
    const quote = await service.quote(input, new Date('2026-11-07T02:00:00Z'));
    expect(quote.quoteAvailable).toBe(true);
    expect(quote.distanceKm).toBe(8);
    expect(quote.volumeM3).toBe(0.03);
    expect(quote.weightKg).toBe(10);
    expect(quote.estimatedDeliveryMinutes).toBe(60);
    expect(quote.shippingBreakdown).toMatchObject({ distanceFee: 0, totalFee: 0 });
    expect(quote.expressEligibility.eligible).toBe(true);
  });

  test('counts packages and sums per-package volume and weight for multiple products and quantities', async () => {
    const small = product({ id: 2, name: 'Máy lọc nước', packageLengthCm: '20', packageWidthCm: '30', packageHeightCm: '50', packageWeightKg: '4' });
    const second = product({ id: 3, name: 'Máy lọc nước mini', packageLengthCm: '10', packageWidthCm: '10', packageHeightCm: '50', packageWeightKg: '2' });
    const { service } = setup([small, second]);
    const quote = await service.quote({ ...input, items: [{ product_id: 2, quantity: 3 }, { product_id: 3, quantity: 1 }] }, new Date('2026-11-07T02:00:00Z'));
    expect(quote.packageCount).toBe(4);
    expect(quote.volumeM3).toBe(0.095);
    expect(quote.weightKg).toBe(14);
  });

  test('uses stored product volume and weight when package measurements are missing', async () => {
    const { service } = setup([product({ packageLengthCm: null, packageWidthCm: null, packageHeightCm: null, packageWeightKg: null })]);
    const quote = await service.quote(input, new Date('2026-11-07T02:00:00Z'));
    expect(quote.quoteAvailable).toBe(true);
    expect(quote.volumeM3).toBe(0.03);
    expect(quote.weightKg).toBe(10);
  });

  test('returns unavailable when Routing API cannot identify a road route', async () => {
    const { service, roadMatrix } = setup();
    roadMatrix.getDrivingRoute.mockRejectedValue(new Error('Không xác định được tuyến đường ô tô.'));
    const quote = await service.quote(input);
    expect(quote.quoteAvailable).toBe(false);
    expect(quote.reasons.join(' ')).toContain('tuyến đường ô tô');
  });

  test('re-runs route calculation when a delivery address changes', async () => {
    const { service, roadMatrix } = setup();
    await service.quote(input);
    await service.quote({ ...input, lat: 11, lng: 107 });
    expect(roadMatrix.getDrivingRoute).toHaveBeenNthCalledWith(2, [10.8, 106.6], [11, 107]);
  });

  test('recalculates package volume and fee when item quantities change', async () => {
    const { service } = setup([product({ packageLengthCm: '20', packageWidthCm: '30', packageHeightCm: '50', packageWeightKg: '4' })]);
    const one = await service.quote(input);
    const two = await service.quote({ ...input, items: [{ product_id: 1, quantity: 2 }] });
    expect(two.packageCount).toBe(2);
    expect(two.volumeM3).toBe(one.volumeM3! * 2);
    expect(two.weightKg).toBe(one.weightKg! * 2);
  });

  test('uses the configured 25 km/h fallback ETA when the road API returns distance only', async () => {
    const { service } = setup([product()], { distanceKm: 8, travelMinutes: null });
    const quote = await service.quote(input, new Date('2026-11-07T01:00:00Z'));
    expect(quote.travelMinutes).toBe(20);
    expect(quote.estimatedDeliveryMinutes).toBe(35);
  });

  test('ignores a client submitted shipping fee and applies current server rates', async () => {
    const { service } = setup([product()], { distanceKm: 25, travelMinutes: 45 });
    const quote = await service.quote({ ...input, shipping_fee: 1 } as any, new Date('2026-11-07T02:00:00Z'));
    expect(quote.shippingBreakdown!.totalFee).toBe(150000);
  });

  test('reflects an admin changed rate and version while an old order keeps its saved snapshot', async () => {
    const { service, settingsRepo } = setup();
    const first = await service.quote(input, new Date('2026-11-07T02:00:00Z'));
    const oldOrder = { shippingFee: first.shippingBreakdown!.totalFee, shippingRateVersion: first.shippingRateVersion };
    settingsRepo.findOne.mockResolvedValue({
      id: 1, shippingFreeDistanceKm: '5', shippingFirstBandEndKm: '30', shippingFirstBandFee: 80000,
      shippingDistanceStepKm: '10', shippingDistanceStepFee: 50000,
      deliveryDayStart: '08:00', deliveryDayEnd: '18:00', expressCutoffTime: '16:00',
      expressMaxMinutes: 300, expressMaxDistanceKm: '10', expressMaxVolumeM3: '0.1', expressMaxWeightKg: null,
      shippingPreparationMinutes: 10, shippingHandoverMinutes: 5,
      shippingAdditionalDelayMinutes: 0, shippingFallbackSpeedKmh: '25', shippingRateVersion: 2,
    } as any);
    const second = await service.quote(input, new Date('2026-11-07T02:00:00Z'));
    expect(second.shippingRateVersion).toBe(2);
    expect(second.shippingBreakdown!.totalFee).toBe(80000);
    expect(oldOrder).toEqual({ shippingFee: 0, shippingRateVersion: 1 });
  });
});
