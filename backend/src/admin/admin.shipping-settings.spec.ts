import { AdminService } from './admin.service';

test('increments the shipping rate version and writes a complete settings snapshot to history', async () => {
  const setting: any = {
    id: 1, shippingRateVersion: 4, shippingPerKmFee: 5000, shippingBaseDistanceKm: '2',
    shippingBaseFee: 15000, shippingExpressFee: 10000, shippingRoundingIncrement: 1000,
    shippingVolumeTiers: [{ max_m3: 0.02, fee: 0 }], shippingWeightFeePerKg: null,
    shippingPreparationMinutes: 10, shippingHandoverMinutes: 5, shippingAdditionalDelayMinutes: 0,
    shippingFallbackSpeedKmh: '25', freeShipFrom: 5000000,
    deliveryDayStart: '08:00', deliveryDayEnd: '18:00', expressCutoffTime: '16:00',
    expressMaxMinutes: 300, expressMaxDistanceKm: '10', expressMaxVolumeM3: '0.1', expressMaxWeightKg: null,
    shippingFee: 150000, avgSpeedKmh: '30', roadFactor: '1.35', weightKm: '1', weightTime: '0.5',
  };
  const savedSettings = () => [{
    shipping_fee: setting.shippingFee, free_ship_from: setting.freeShipFrom,
    shipping_base_distance_km: setting.shippingBaseDistanceKm, shipping_base_fee: setting.shippingBaseFee,
    shipping_per_km_fee: setting.shippingPerKmFee, shipping_express_fee: setting.shippingExpressFee,
    shipping_rounding_increment: setting.shippingRoundingIncrement, shipping_volume_tiers: setting.shippingVolumeTiers,
    shipping_weight_fee_per_kg: setting.shippingWeightFeePerKg, shipping_preparation_minutes: setting.shippingPreparationMinutes,
    shipping_handover_minutes: setting.shippingHandoverMinutes, shipping_additional_delay_minutes: setting.shippingAdditionalDelayMinutes,
    shipping_fallback_speed_kmh: setting.shippingFallbackSpeedKmh, shipping_rate_version: setting.shippingRateVersion,
    delivery_day_start: setting.deliveryDayStart, delivery_day_end: setting.deliveryDayEnd,
    express_cutoff_time: setting.expressCutoffTime, express_max_minutes: setting.expressMaxMinutes,
    express_max_distance_km: setting.expressMaxDistanceKm, express_max_volume_m3: setting.expressMaxVolumeM3,
    express_max_weight_kg: setting.expressMaxWeightKg,
    avg_speed_kmh: setting.avgSpeedKmh, road_factor: setting.roadFactor, weight_km: setting.weightKm, weight_time: setting.weightTime,
  }];
  const repo = {
    findOne: jest.fn(async () => setting),
    create: jest.fn((row) => row),
    save: jest.fn(async (row) => row),
  };
  const db = {
    getRepository: () => repo,
    query: jest.fn(async (sql: string, ..._params: any[]) => {
      if (sql.includes('FROM warehouse')) return [];
      if (sql.includes('FROM system_setting')) return savedSettings();
      return [];
    }),
  };
  const service = new AdminService(db as any, { get: (_key: string, fallback: unknown) => fallback } as any);
  await service.updateSettings({ shipping_per_km_fee: 6500 });
  await service.updateSettings({ shipping_per_km_fee: 6500 });

  expect(setting.shippingRateVersion).toBe(5);
  const historyInsert = db.query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO shipping_rate_history'));
  expect(historyInsert?.[1]?.[0]).toBe(5);
  expect(db.query.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO shipping_rate_history'))).toHaveLength(1);
  expect(JSON.parse(String(historyInsert?.[1]?.[1])).shipping.per_km_fee).toBe(6500);
});
