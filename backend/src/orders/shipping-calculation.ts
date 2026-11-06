export type DeliveryType = 'STANDARD' | 'EXPRESS';

export interface VolumeTier { max_m3: number | null; fee: number }

export interface ShippingRules {
  dayStart: string;
  dayEnd: string;
  expressCutoff: string;
  expressMaxMinutes: number;
  expressMaxDistanceKm: number;
  expressMaxVolumeM3: number;
  expressMaxWeightKg: number | null;
  freeDistanceKm?: number;
  firstDistanceBandEndKm?: number;
  firstDistanceBandFee?: number;
  nextDistanceStepKm?: number;
  nextDistanceStepFee?: number;
  // Legacy settings remain in the type for compatibility with existing callers.
  baseDistanceKm: number;
  baseFee: number;
  perKmFee: number;
  expressFee: number;
  roundingIncrement: number;
  volumeTiers: VolumeTier[];
  weightFeePerKg: number | null;
  preparationMinutes: number;
  handoverMinutes: number;
  additionalDelayMinutes: number;
  fallbackSpeedKmh: number;
  freeShipFrom: number;
  rateVersion: number;
}

export function localParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value || '00';
  const year = Number(value('year')), month = Number(value('month')), day = Number(value('day'));
  const hour = Number(value('hour')), minute = Number(value('minute'));
  return { year, month, day, hour, minute, minutes: hour * 60 + minute, date: `${value('year')}-${value('month')}-${value('day')}` };
}

function localDateTimeUtc(date: string, time: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  // Vietnam is UTC+07:00 and has no daylight saving time.
  return new Date(Date.UTC(year, month - 1, day, hour - 7, minute));
}

function nextLocalDay(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
}

export function etaMinutes(distanceKm: number, routingMinutes: number | null, rules: ShippingRules): number {
  const travel = routingMinutes ?? Math.ceil((distanceKm / rules.fallbackSpeedKmh) * 60);
  return rules.preparationMinutes + travel + rules.handoverMinutes + rules.additionalDelayMinutes;
}

export function standardArrivalAt(acceptedAt: Date, durationMinutes: number, rules: ShippingRules): Date {
  const accepted = localParts(acceptedAt);
  const [startHour, startMinute] = rules.dayStart.split(':').map(Number);
  const [endHour, endMinute] = rules.dayEnd.split(':').map(Number);
  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  if (accepted.minutes < start) {
    return new Date(localDateTimeUtc(accepted.date, rules.dayStart).getTime() + durationMinutes * 60_000);
  }
  if (accepted.minutes >= end) {
    return new Date(localDateTimeUtc(nextLocalDay(accepted.date), rules.dayStart).getTime() + durationMinutes * 60_000);
  }
  const arrival = new Date(acceptedAt.getTime() + durationMinutes * 60_000);
  const local = localParts(arrival);
  if (local.minutes >= end) return new Date(localDateTimeUtc(nextLocalDay(local.date), rules.dayStart).getTime() + durationMinutes * 60_000);
  return arrival;
}

export function expressEligibility(input: {
  acceptedAt: Date;
  distanceKm: number;
  volumeM3: number;
  weightKg: number;
  durationMinutes: number;
  hasStock: boolean;
  hasVehicleCapacity: boolean;
  rules: ShippingRules;
}): { eligible: boolean; reasons: string[]; deadlineAt: Date; estimatedArrivalAt: Date } {
  const { acceptedAt, distanceKm, volumeM3, weightKg, durationMinutes, hasStock, hasVehicleCapacity, rules } = input;
  const local = localParts(acceptedAt);
  const todayEnd = localDateTimeUtc(local.date, rules.dayEnd);
  const expressDeadline = new Date(Math.min(acceptedAt.getTime() + rules.expressMaxMinutes * 60_000, todayEnd.getTime()));
  const estimatedArrivalAt = new Date(acceptedAt.getTime() + durationMinutes * 60_000);
  const cutoff = Number(rules.expressCutoff.slice(0, 2)) * 60 + Number(rules.expressCutoff.slice(3, 5));
  const start = Number(rules.dayStart.slice(0, 2)) * 60 + Number(rules.dayStart.slice(3, 5));
  const end = Number(rules.dayEnd.slice(0, 2)) * 60 + Number(rules.dayEnd.slice(3, 5));
  const reasons: string[] = [];
  if (local.minutes < start || local.minutes >= cutoff) reasons.push(`Nhận hỏa tốc từ ${rules.dayStart} đến trước ${rules.expressCutoff}.`);
  if (distanceKm > rules.expressMaxDistanceKm) reasons.push(`Khoảng cách vượt giới hạn ${rules.expressMaxDistanceKm} km.`);
  if (volumeM3 > rules.expressMaxVolumeM3) reasons.push(`Thể tích vượt giới hạn ${rules.expressMaxVolumeM3} m³.`);
  if (rules.expressMaxWeightKg !== null && weightKg > rules.expressMaxWeightKg) reasons.push(`Trọng lượng vượt giới hạn ${rules.expressMaxWeightKg} kg.`);
  if (durationMinutes > rules.expressMaxMinutes) reasons.push(`Thời gian giao dự kiến vượt ${rules.expressMaxMinutes} phút.`);
  if (localParts(estimatedArrivalAt).minutes > end || estimatedArrivalAt.getTime() > expressDeadline.getTime()) reasons.push(`Thời điểm giao dự kiến vượt ca ${rules.dayStart}–${rules.dayEnd} hoặc thời hạn hỏa tốc.`);
  if (!hasStock) reasons.push('Kho không đủ hàng sẵn sàng cho đơn này.');
  if (!hasVehicleCapacity) reasons.push('Chưa có phương tiện hoạt động đủ sức chứa cho đơn hàng.');
  return { eligible: reasons.length === 0, reasons, deadlineAt: expressDeadline, estimatedArrivalAt };
}

export function volumeFee(volumeM3: number, tiers: VolumeTier[]): number | null {
  const sorted = [...tiers].sort((a, b) => (a.max_m3 ?? Infinity) - (b.max_m3 ?? Infinity));
  for (const tier of sorted) {
    if (tier.max_m3 === null || volumeM3 <= tier.max_m3) return Math.max(0, Math.trunc(tier.fee));
  }

  const finiteTiers = sorted.filter((tier): tier is VolumeTier & { max_m3: number } => tier.max_m3 !== null);
  const last = finiteTiers[finiteTiers.length - 1];
  if (!last) return null;
  const previous = finiteTiers[finiteTiers.length - 2];
  if (!previous || last.max_m3 <= previous.max_m3) return Math.max(0, Math.trunc(last.fee));

  // Continue the last configured volume and fee step for larger packages.
  const volumeStep = last.max_m3 - previous.max_m3;
  const feeStep = Math.max(0, last.fee - previous.fee);
  const steps = Math.ceil((volumeM3 - last.max_m3) / volumeStep);
  return Math.max(0, Math.trunc(last.fee + steps * feeStep));
}

export function distanceShippingFee(distanceKm: number, rules: ShippingRules): number {
  const freeDistanceKm = rules.freeDistanceKm ?? 20;
  const firstBandEndKm = rules.firstDistanceBandEndKm ?? 30;
  const firstBandFee = rules.firstDistanceBandFee ?? 150_000;
  const nextStepKm = rules.nextDistanceStepKm ?? 10;
  const nextStepFee = rules.nextDistanceStepFee ?? 50_000;
  if (distanceKm <= freeDistanceKm) return 0;
  if (distanceKm <= firstBandEndKm) return Math.max(0, Math.trunc(firstBandFee));
  const additionalSteps = Math.ceil((distanceKm - firstBandEndKm) / nextStepKm);
  return Math.max(0, Math.trunc(firstBandFee + additionalSteps * nextStepFee));
}

export function buildShippingBreakdown(input: {
  distanceKm: number; volumeM3: number; weightKg: number; subtotal: number; deliveryType: DeliveryType; rules: ShippingRules;
}) {
  const { distanceKm, rules } = input;
  const distanceFee = distanceShippingFee(distanceKm, rules);
  return {
    distanceFee, volumeFee: 0, weightFee: 0, expressFee: 0, discount: 0,
    totalFee: distanceFee,
  };
}
