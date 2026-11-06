import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Product, SystemSetting, Vehicle, Warehouse } from '../database/entities';
import { RoadMatrixService } from '../optimization/road-matrix.service';
import { buildShippingBreakdown, DeliveryType, etaMinutes, expressEligibility, localParts, ShippingRules, standardArrivalAt } from './shipping-calculation';

export interface ShippingQuoteInput {
  lat: number;
  lng: number;
  items: Array<{ product_id: number; quantity: number }>;
  delivery_type?: DeliveryType;
}

@Injectable()
export class ShippingQuoteService {
  constructor(
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(Warehouse) private readonly warehouses: Repository<Warehouse>,
    @InjectRepository(Vehicle) private readonly vehicles: Repository<Vehicle>,
    @InjectRepository(SystemSetting) private readonly settings: Repository<SystemSetting>,
    private readonly roadMatrix: RoadMatrixService,
  ) {}

  async quote(input: ShippingQuoteInput, acceptedAt = new Date()) {
    const deliveryType = input.delivery_type || 'STANDARD';
    const quantities = new Map<number, number>();
    for (const item of input.items) quantities.set(item.product_id, (quantities.get(item.product_id) || 0) + item.quantity);
    const productRows = await this.products.find({ where: { id: In([...quantities.keys()]), active: true } });
    const productById = new Map(productRows.map((product) => [product.id, product]));
    const missingProducts = [...quantities.keys()].filter((id) => !productById.has(id));
    const packageIssues: string[] = [];
    const rows: Array<{ product: Product; quantity: number }> = [];
    let volumeM3 = 0;
    let weightKg = 0;
    let packageCount = 0;
    let hasStock = missingProducts.length === 0;
    const packageMetrics = new Map<number, {
      dimensions: [number, number, number] | null;
      weightKg: number | null;
    }>();
    for (const [id, quantity] of quantities) {
      const product = productById.get(id);
      if (!product) { packageIssues.push(`Không tìm thấy sản phẩm ${id}.`); continue; }
      rows.push({ product, quantity });
      if (product.stock < quantity) hasStock = false;
      const dimensions = [product.packageLengthCm, product.packageWidthCm, product.packageHeightCm].map((value) => value == null ? null : Number(value));
      const validDimensions = dimensions.every((value) => value !== null && Number.isFinite(value) && value > 0);
      const packagedVolumeM3 = validDimensions
        ? (dimensions[0]! * dimensions[1]! * dimensions[2]!) / 1_000_000
        : null;
      const catalogVolumeM3 = product.volumeM3 == null ? null : Number(product.volumeM3);
      const unitVolumeM3 = packagedVolumeM3 ?? catalogVolumeM3;
      const packagedWeightKg = product.packageWeightKg == null ? null : Number(product.packageWeightKg);
      const catalogWeightKg = product.weightKg == null ? null : Number(product.weightKg);
      const unitWeightKg = packagedWeightKg !== null && Number.isFinite(packagedWeightKg) && packagedWeightKg > 0
        ? packagedWeightKg
        : catalogWeightKg;
      if (unitVolumeM3 === null || !Number.isFinite(unitVolumeM3) || unitVolumeM3 <= 0) {
        packageIssues.push(`Thiếu thể tích sản phẩm (m³) của sản phẩm “${product.name}”.`);
      } else {
        volumeM3 += unitVolumeM3 * quantity;
      }
      if (unitWeightKg === null || !Number.isFinite(unitWeightKg) || unitWeightKg <= 0) {
        packageIssues.push(`Thiếu trọng lượng sản phẩm (kg) của sản phẩm “${product.name}”.`);
      } else {
        weightKg += unitWeightKg * quantity;
      }
      packageMetrics.set(product.id, {
        dimensions: validDimensions ? dimensions as [number, number, number] : null,
        weightKg: unitWeightKg !== null && Number.isFinite(unitWeightKg) && unitWeightKg > 0 ? unitWeightKg : null,
      });
      packageCount += quantity;
    }
    const packageDetails = rows.flatMap(({ product, quantity }) => {
      const metrics = packageMetrics.get(product.id);
      if (!metrics?.dimensions || metrics.weightKg === null) return [];
      const [lengthCm, widthCm, heightCm] = metrics.dimensions;
      return [{ productId: product.id, lengthCm, widthCm, heightCm, weightKg: metrics.weightKg, quantity }];
    });
    const estimatedInstallationMinutes = rows.reduce(
      (sum, { product, quantity }) => sum + Math.max(0, Number(product.installMinutes) || 0) * quantity,
      0,
    );
    const rules = await this.shippingRules();
    const [warehouse] = await this.warehouses.find({ order: { id: 'ASC' }, take: 1 });
    if (!warehouse) return this.unavailable(['Chưa khai báo kho xử lý đơn hàng.'], deliveryType, volumeM3, weightKg, packageCount, rules);

    let route: { distanceKm: number; travelMinutes: number | null };
    try {
      route = await this.roadMatrix.getDrivingRoute([Number(warehouse.lat), Number(warehouse.lng)], [input.lat, input.lng]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không xác định được tuyến đường ô tô.';
      return this.unavailable([message], deliveryType, volumeM3, weightKg, packageCount, rules, warehouse.id);
    }

    if (packageIssues.length) return this.unavailable(packageIssues, deliveryType, volumeM3, weightKg, packageCount, rules, warehouse.id, route.distanceKm);

    const eligibleVehicles = await this.vehicles.find({ where: { active: true } });
    const hasVehicleCapacity = eligibleVehicles.some((vehicle) => Number(vehicle.capacityM3) >= volumeM3 && Number(vehicle.capacityKg) >= weightKg);
    const estimatedDeliveryMinutes = etaMinutes(route.distanceKm, route.travelMinutes, rules);
    const express = expressEligibility({ acceptedAt, distanceKm: route.distanceKm, volumeM3, weightKg, durationMinutes: estimatedDeliveryMinutes, hasStock, hasVehicleCapacity, rules });
    const estimatedArrivalAt = deliveryType === 'EXPRESS' ? express.estimatedArrivalAt : standardArrivalAt(acceptedAt, estimatedDeliveryMinutes, rules);
    const breakdown = buildShippingBreakdown({ distanceKm: route.distanceKm, rules });
    const totalFee = Math.max(0, breakdown.totalFee);
    return {
      quoteAvailable: true,
      acceptedAt: acceptedAt.toISOString(),
      warehouseId: warehouse.id,
      deliveryType,
      distanceKm: round(route.distanceKm, 3),
      volumeM3: round(volumeM3, 4),
      weightKg: round(weightKg, 3),
      packageCount,
      packageDetails,
      estimatedInstallationMinutes,
      estimatedDeliveryMinutes,
      estimatedArrivalAt: estimatedArrivalAt.toISOString(),
      deliveryWindowDate: localParts(estimatedArrivalAt).date,
      reasons: [],
      travelMinutes: route.travelMinutes ?? Math.ceil((route.distanceKm / rules.fallbackSpeedKmh) * 60),
      preparationMinutes: rules.preparationMinutes,
      shippingBreakdown: { ...breakdown, totalFee },
      expressEligibility: {
        eligible: express.eligible,
        reasons: express.reasons,
        maxDeliveryMinutes: rules.expressMaxMinutes,
        cutoffTime: rules.expressCutoff,
        deadlineAt: express.deadlineAt.toISOString(),
      },
      shippingRateVersion: rules.rateVersion,
      packageDimensionsCm: packageCount === 1 && rows.length === 1 && packageMetrics.get(rows[0].product.id)?.dimensions ? {
        length: packageMetrics.get(rows[0].product.id)!.dimensions![0],
        width: packageMetrics.get(rows[0].product.id)!.dimensions![1],
        height: packageMetrics.get(rows[0].product.id)!.dimensions![2],
      } : null,
      inventoryAvailable: hasStock,
      vehicleCapacityAvailable: hasVehicleCapacity,
    };
  }

  async shippingRules(): Promise<ShippingRules> {
    const row = await this.settings.findOne({ where: { id: 1 } }).catch(() => null);
    return {
      dayStart: row?.deliveryDayStart || '08:00', dayEnd: row?.deliveryDayEnd || '18:00',
      expressCutoff: row?.expressCutoffTime || '16:00', expressMaxMinutes: Number(row?.expressMaxMinutes ?? 300),
      expressMaxDistanceKm: Number(row?.expressMaxDistanceKm ?? 10), expressMaxVolumeM3: Number(row?.expressMaxVolumeM3 ?? 0.1),
      expressMaxWeightKg: row?.expressMaxWeightKg == null ? null : Number(row.expressMaxWeightKg),
      freeDistanceKm: Number(row?.shippingFreeDistanceKm ?? 20),
      firstDistanceBandEndKm: Number(row?.shippingFirstBandEndKm ?? 30),
      firstDistanceBandFee: Number(row?.shippingFirstBandFee ?? 150000),
      nextDistanceStepKm: Number(row?.shippingDistanceStepKm ?? 10),
      nextDistanceStepFee: Number(row?.shippingDistanceStepFee ?? 50000),
      preparationMinutes: Number(row?.shippingPreparationMinutes ?? 10), handoverMinutes: Number(row?.shippingHandoverMinutes ?? 5),
      additionalDelayMinutes: Number(row?.shippingAdditionalDelayMinutes ?? 0), fallbackSpeedKmh: Number(row?.shippingFallbackSpeedKmh ?? 25),
      rateVersion: Number(row?.shippingRateVersion ?? 1),
    };
  }

  private unavailable(reasons: string[], deliveryType: DeliveryType, volumeM3: number, weightKg: number, packageCount: number, rules: ShippingRules, warehouseId?: number, distanceKm?: number) {
    return {
      quoteAvailable: false, acceptedAt: new Date().toISOString(), warehouseId: warehouseId ?? null,
      deliveryType, distanceKm: distanceKm == null ? null : round(distanceKm, 3),
      volumeM3: packageCount ? round(volumeM3, 4) : null, weightKg: packageCount ? round(weightKg, 3) : null,
      packageCount, estimatedInstallationMinutes: null, estimatedDeliveryMinutes: null, estimatedArrivalAt: null, deliveryWindowDate: null,
      packageDetails: null,
      shippingBreakdown: null, reasons,
      packageDimensionsCm: null, travelMinutes: null, preparationMinutes: null,
      inventoryAvailable: false, vehicleCapacityAvailable: false,
      expressEligibility: { eligible: false, reasons, maxDeliveryMinutes: rules.expressMaxMinutes, cutoffTime: rules.expressCutoff },
      shippingRateVersion: rules.rateVersion,
    };
  }
}

function round(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
