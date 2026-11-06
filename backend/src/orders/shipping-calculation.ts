export type DeliveryType = 'STANDARD' | 'EXPRESS';

export interface ShippingRules {
  dayStart: string;
  dayEnd: string;
  expressCutoff: string;
  expressMaxMinutes: number;
  expressMaxDistanceKm: number;
  expressMaxWeightKg: number | null;
  freeDistanceKm: number;
  firstDistanceBandEndKm: number;
  firstDistanceBandFee: number;
  nextDistanceStepKm: number;
  nextDistanceStepFee: number;
  preparationMinutes: number;
  handoverMinutes: number;
  additionalDelayMinutes: number;
  fallbackSpeedKmh: number;
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
  const { acceptedAt, distanceKm, weightKg, durationMinutes, hasStock, hasVehicleCapacity, rules } = input;
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
  if (rules.expressMaxWeightKg !== null && weightKg > rules.expressMaxWeightKg) reasons.push(`Trọng lượng vượt giới hạn ${rules.expressMaxWeightKg} kg.`);
  if (durationMinutes > rules.expressMaxMinutes) reasons.push(`Thời gian giao dự kiến vượt ${rules.expressMaxMinutes} phút.`);
  if (localParts(estimatedArrivalAt).minutes > end || estimatedArrivalAt.getTime() > expressDeadline.getTime()) reasons.push(`Thời điểm giao dự kiến vượt ca ${rules.dayStart}–${rules.dayEnd} hoặc thời hạn hỏa tốc.`);
  if (!hasStock) reasons.push('Kho không đủ hàng sẵn sàng cho đơn này.');
  if (!hasVehicleCapacity) reasons.push('Chưa có phương tiện hoạt động đủ sức chứa cho đơn hàng.');
  return { eligible: reasons.length === 0, reasons, deadlineAt: expressDeadline, estimatedArrivalAt };
}

export function distanceShippingFee(distanceKm: number, rules: ShippingRules): number {
  if (distanceKm <= rules.freeDistanceKm) return 0;
  if (distanceKm <= rules.firstDistanceBandEndKm) return Math.max(0, Math.trunc(rules.firstDistanceBandFee));
  const additionalSteps = Math.ceil((distanceKm - rules.firstDistanceBandEndKm) / rules.nextDistanceStepKm);
  return Math.max(0, Math.trunc(rules.firstDistanceBandFee + additionalSteps * rules.nextDistanceStepFee));
}

export function buildShippingBreakdown(input: { distanceKm: number; rules: ShippingRules }) {
  const { distanceKm, rules } = input;
  const distanceFee = distanceShippingFee(distanceKm, rules);
  return { distanceFee, totalFee: distanceFee };
}
