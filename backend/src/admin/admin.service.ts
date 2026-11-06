import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { SystemSetting } from '../database/entities';
import { UpdateSettingsDto } from './admin.dto';

function normalizedShippingSettings(row: SystemSetting) {
  const fallbackTiers = [
    { max_m3: 0.02, fee: 0 }, { max_m3: 0.05, fee: 5000 }, { max_m3: 0.1, fee: 10000 }, { max_m3: 0.15, fee: 20000 },
  ];
  const tiers = row.shippingVolumeTiers
    ? typeof row.shippingVolumeTiers === 'string' ? JSON.parse(row.shippingVolumeTiers) : row.shippingVolumeTiers
    : fallbackTiers;
  return JSON.stringify({
    shippingFee: Number(row.shippingFee ?? 150000), freeShipFrom: Number(row.freeShipFrom ?? 5000000),
    freeDistanceKm: Number(row.shippingFreeDistanceKm ?? 20),
    firstDistanceBandEndKm: Number(row.shippingFirstBandEndKm ?? 30),
    firstDistanceBandFee: Number(row.shippingFirstBandFee ?? 150000),
    nextDistanceStepKm: Number(row.shippingDistanceStepKm ?? 10),
    nextDistanceStepFee: Number(row.shippingDistanceStepFee ?? 50000),
    dayStart: row.deliveryDayStart || '08:00', dayEnd: row.deliveryDayEnd || '18:00',
    cutoff: row.expressCutoffTime || '16:00', expressMinutes: Number(row.expressMaxMinutes ?? 300),
    expressDistance: Number(row.expressMaxDistanceKm ?? 10),
    expressWeight: row.expressMaxWeightKg == null ? null : Number(row.expressMaxWeightKg),
    baseDistance: Number(row.shippingBaseDistanceKm ?? 2), baseFee: Number(row.shippingBaseFee ?? 15000),
    perKmFee: Number(row.shippingPerKmFee ?? 5000), expressFee: Number(row.shippingExpressFee ?? 10000),
    rounding: Number(row.shippingRoundingIncrement ?? 1000), tiers,
    weightFeePerKg: row.shippingWeightFeePerKg == null ? null : Number(row.shippingWeightFeePerKg),
    delay: Number(row.shippingAdditionalDelayMinutes ?? 0), preparation: Number(row.shippingPreparationMinutes ?? 10),
    handover: Number(row.shippingHandoverMinutes ?? 5), fallbackSpeed: Number(row.shippingFallbackSpeedKmh ?? 25),
  });
}

function checkedRange(from:string,to:string) {
  const parse=(s:string)=>{ if(!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new BadRequestException('Ngày phải có dạng YYYY-MM-DD'); const d=new Date(`${s}T00:00:00Z`);if(Number.isNaN(d.getTime()) || d.toISOString().slice(0,10)!==s)throw new BadRequestException('Ngày không hợp lệ');return d.getTime(); };
  const a=parse(from),b=parse(to);if(a>b || b-a>366*86400000)throw new BadRequestException('Khoảng ngày không hợp lệ hoặc vượt 367 ngày');
}
@Injectable()
export class AdminService {
  constructor(private readonly db:DataSource,private readonly config:ConfigService) {}
  async report(from:string,to:string) {
    checkedRange(from,to);
    const [orders,stops,routes] = await Promise.all([
      this.db.query(`SELECT DATE_FORMAT(delivery_date,'%Y-%m-%d') day, COUNT(*) total, SUM(status='PENDING') pending, SUM(status='READY') ready, SUM(status='DELIVERED') delivered, SUM(status='FAILED') failed_orders, SUM(status='CANCELLED') cancelled, COALESCE(SUM(CASE WHEN status='DELIVERED' THEN total ELSE 0 END),0) revenue FROM orders WHERE delivery_date BETWEEN ? AND ? GROUP BY delivery_date ORDER BY delivery_date`,[from,to]),
      this.db.query(`SELECT DATE_FORMAT(s.completed_at,'%Y-%m-%d') day, COUNT(*) attempts, SUM(s.result='DELIVERED') delivered, SUM(s.result='FAILED') failed, SUM(CASE WHEN s.result='DELIVERED' AND s.actual_arrival IS NOT NULL THEN 1 ELSE 0 END) timed, SUM(CASE WHEN s.result='DELIVERED' AND DATE(s.actual_arrival)=r.route_date AND TIME(s.actual_arrival) BETWEEN o.time_window_start AND o.time_window_end THEN 1 ELSE 0 END) on_time FROM delivery_stop s JOIN route r ON r.id=s.route_id JOIN orders o ON o.id=s.order_id WHERE s.completed_at>=? AND s.completed_at<DATE_ADD(?, INTERVAL 1 DAY) AND s.result IN ('DELIVERED','FAILED') GROUP BY DATE_FORMAT(s.completed_at,'%Y-%m-%d') ORDER BY day`,[from,to]),
      this.db.query(`SELECT DATE_FORMAT(route_date,'%Y-%m-%d') day, COUNT(*) routes, COALESCE(SUM(total_km),0) planned_km, SUM(CASE WHEN baseline_km IS NOT NULL THEN 1 ELSE 0 END) comparable_routes, COALESCE(SUM(CASE WHEN baseline_km IS NOT NULL THEN baseline_km ELSE 0 END),0) baseline_km, COALESCE(SUM(CASE WHEN baseline_km IS NOT NULL THEN total_km ELSE 0 END),0) comparable_km FROM route WHERE route_date BETWEEN ? AND ? AND status IN ('LOCKED','IN_PROGRESS','DONE') GROUP BY route_date ORDER BY route_date`,[from,to]),
    ]);
    const days=new Map<string,Record<string,number|string>>();
    const entry=(date:string)=>{if(!days.has(date))days.set(date,{date,orders:0,pending:0,ready:0,delivered_orders:0,failed_orders:0,cancelled:0,revenue:0,attempts:0,delivered_attempts:0,failed_attempts:0,timed:0,on_time:0,routes:0,planned_km:0,comparable_routes:0,baseline_km:0,comparable_km:0});return days.get(date)!;};
    for(const row of orders) Object.assign(entry(row.day),{orders:Number(row.total),pending:Number(row.pending),ready:Number(row.ready),delivered_orders:Number(row.delivered),failed_orders:Number(row.failed_orders),cancelled:Number(row.cancelled),revenue:Number(row.revenue)});
    for(const row of stops) Object.assign(entry(row.day),{attempts:Number(row.attempts),delivered_attempts:Number(row.delivered),failed_attempts:Number(row.failed),timed:Number(row.timed),on_time:Number(row.on_time)});
    for(const row of routes) Object.assign(entry(row.day),{routes:Number(row.routes),planned_km:Number(row.planned_km),comparable_routes:Number(row.comparable_routes),baseline_km:Number(row.baseline_km),comparable_km:Number(row.comparable_km)});
    const series=[...days.values()].sort((a,b)=>String(a.date).localeCompare(String(b.date)));
    const fields=['orders','pending','ready','delivered_orders','failed_orders','cancelled','revenue','attempts','delivered_attempts','failed_attempts','timed','on_time','routes','planned_km','comparable_routes','baseline_km','comparable_km'];
    const totals:Record<string,number|null>={};for(const field of fields)totals[field]=series.reduce((sum,row)=>sum+Number(row[field]),0);
    totals.on_time_rate=totals.timed ? totals.on_time! / totals.timed : null;
    totals.failure_rate=totals.attempts ? totals.failed_attempts! / totals.attempts : null;
    totals.saved_km=totals.baseline_km! - totals.comparable_km!;
    return {from,to,totals,series};
  }
  async dashboard(date:string) {
    const report=await this.report(date,date);
    const [todo]=await this.db.query("SELECT SUM(status='PENDING') pending, SUM(status IN ('PENDING','CONFIRMED','READY') AND (lat IS NULL OR lng IS NULL)) missing_location, SUM(status='READY' AND delivery_date=?) ready_today FROM orders",[date]);
    const [routeTodo]=await this.db.query("SELECT SUM(status='DRAFT') drafts, SUM(status='LOCKED') locked FROM route WHERE route_date=?",[date]);
    return {...report, todo:{pending:Number(todo.pending||0),missing_location:Number(todo.missing_location||0),ready_today:Number(todo.ready_today||0),drafts:Number(routeTodo.drafts||0),locked:Number(routeTodo.locked||0)}};
  }
  async customers(){
    const rows=await this.db.query(`SELECT c.id,c.name,c.phone,c.email,COUNT(o.id) orders,COALESCE(SUM(CASE WHEN o.status='DELIVERED' THEN o.total ELSE 0 END),0) spent,DATE_FORMAT(MAX(o.delivery_date),'%Y-%m-%d') last_delivery,EXISTS(SELECT 1 FROM \`user\` u WHERE u.customer_id=c.id) has_account FROM customer c LEFT JOIN orders o ON o.customer_id=c.id GROUP BY c.id,c.name,c.phone,c.email ORDER BY c.id DESC LIMIT 500`);
    return rows.map((row:{orders:string;spent:string;has_account:number})=>({...row,orders:Number(row.orders),spent:Number(row.spent),has_account:Boolean(row.has_account)}));
  }
  async audit(limit:number,before?:string){
    if(!Number.isInteger(limit)||limit<1||limit>200 || (before!==undefined&&!/^\d+$/.test(before)))throw new BadRequestException('Tham số phân trang không hợp lệ');
    const rows=await this.db.query(`SELECT CAST(id AS CHAR) id,user_id,actor_name,actor_role,method,path,details,created_at FROM audit_event ${before?'WHERE id < ?':''} ORDER BY id DESC LIMIT ?`,before?[before,limit]:[limit]);
    return {items:rows,next_before:rows.length===limit?String(rows[rows.length-1].id):null};
  }
  async settings(){
    const [warehouse]=await this.db.query('SELECT id,name,address,lat,lng FROM warehouse ORDER BY id LIMIT 1');
    const [setting]=await this.db.query('SELECT * FROM system_setting WHERE id=1');
    return {
      warehouse: warehouse || null,
      shipping: {
        fee: setting ? Number(setting.shipping_fee) : this.config.get<number>('shipping.fee', 150000),
        free_from: setting ? Number(setting.free_ship_from) : this.config.get<number>('shipping.freeFrom', 5000000),
        base_distance_km: Number(setting?.shipping_base_distance_km ?? 2),
        base_fee: Number(setting?.shipping_base_fee ?? 15000),
        per_km_fee: Number(setting?.shipping_per_km_fee ?? 5000),
        free_distance_km: Number(setting?.shipping_free_distance_km ?? 20),
        first_band_end_km: Number(setting?.shipping_first_band_end_km ?? 30),
        first_band_fee: Number(setting?.shipping_first_band_fee ?? 150000),
        distance_step_km: Number(setting?.shipping_distance_step_km ?? 10),
        distance_step_fee: Number(setting?.shipping_distance_step_fee ?? 50000),
        express_fee: Number(setting?.shipping_express_fee ?? 10000),
        rounding_increment: Number(setting?.shipping_rounding_increment ?? 1000),
        volume_tiers: setting?.shipping_volume_tiers ? (typeof setting.shipping_volume_tiers === 'string' ? JSON.parse(setting.shipping_volume_tiers) : setting.shipping_volume_tiers) : [
          { max_m3: 0.02, fee: 0 }, { max_m3: 0.05, fee: 5000 }, { max_m3: 0.1, fee: 10000 }, { max_m3: 0.15, fee: 20000 },
        ],
        weight_fee_per_kg: setting?.shipping_weight_fee_per_kg == null ? null : Number(setting.shipping_weight_fee_per_kg),
        preparation_minutes: Number(setting?.shipping_preparation_minutes ?? 10),
        handover_minutes: Number(setting?.shipping_handover_minutes ?? 5),
        additional_delay_minutes: Number(setting?.shipping_additional_delay_minutes ?? 0),
        fallback_speed_kmh: Number(setting?.shipping_fallback_speed_kmh ?? 25),
        rate_version: Number(setting?.shipping_rate_version ?? 1),
      },
      express: {
        cutoff_time: setting?.express_cutoff_time || '16:00',
        max_minutes: Number(setting?.express_max_minutes ?? 300),
        max_distance_km: Number(setting?.express_max_distance_km ?? 10),
        max_weight_kg: setting?.express_max_weight_kg == null ? null : Number(setting.express_max_weight_kg),
      },
      optimization: {
        day_start: setting?.delivery_day_start || this.config.get<string>('optimization.dayStart', '08:00'),
        day_end: setting?.delivery_day_end || this.config.get<string>('optimization.dayEnd', '18:00'),
        speed_kmh: setting ? Number(setting.avg_speed_kmh) : this.config.get<number>('optimization.avgSpeedKmh', 30),
        road_factor: setting ? Number(setting.road_factor) : this.config.get<number>('optimization.roadFactor', 1.35),
        weight_km: setting ? Number(setting.weight_km) : this.config.get<number>('optimization.weightKm', 1.0),
        weight_time: setting ? Number(setting.weight_time) : this.config.get<number>('optimization.weightTime', 0.5),
      },
      payment: {
        bank_name: setting?.bank_name ?? this.config.get<string>('payment.bankName', ''),
        bank_account_name: setting?.bank_account_name ?? this.config.get<string>('payment.accountName', ''),
        bank_account_number: setting?.bank_account_number ?? this.config.get<string>('payment.accountNumber', ''),
        bank_transfer_prefix: setting?.bank_transfer_prefix || this.config.get<string>('payment.transferContentPrefix', 'THONGVAN'),
      },
      warranty: {
        contact: setting?.warranty_contact ?? this.config.get<string>('warranty.contact', ''),
      },
    };
  }

  async updateSettings(body: UpdateSettingsDto){
    const repo = this.db.getRepository(SystemSetting);
    let row = await repo.findOne({ where: { id: 1 } });
    if (!row) {
      row = repo.create({ id: 1 });
    }
    const previousRate = normalizedShippingSettings(row);
    const freeDistanceKm = Number(body.shipping_free_distance_km ?? row.shippingFreeDistanceKm ?? 20);
    const firstBandEndKm = Number(body.shipping_first_band_end_km ?? row.shippingFirstBandEndKm ?? 30);
    const distanceStepKm = Number(body.shipping_distance_step_km ?? row.shippingDistanceStepKm ?? 10);
    if (firstBandEndKm <= freeDistanceKm) {
      throw new BadRequestException('Ngưỡng kết thúc cước đầu phải lớn hơn ngưỡng miễn phí theo quãng đường.');
    }
    if (distanceStepKm <= 0) {
      throw new BadRequestException('Mỗi bước quãng đường tiếp theo phải lớn hơn 0 km.');
    }
    if (body.shipping_fee !== undefined) row.shippingFee = body.shipping_fee;
    if (body.free_ship_from !== undefined) row.freeShipFrom = body.free_ship_from;
    if (body.express_cutoff_time !== undefined) row.expressCutoffTime = body.express_cutoff_time;
    if (body.express_max_minutes !== undefined) row.expressMaxMinutes = body.express_max_minutes;
    if (body.express_max_distance_km !== undefined) row.expressMaxDistanceKm = String(body.express_max_distance_km);
    if (body.express_max_weight_kg !== undefined) row.expressMaxWeightKg = body.express_max_weight_kg == null ? null : String(body.express_max_weight_kg);
    if (body.shipping_base_distance_km !== undefined) row.shippingBaseDistanceKm = String(body.shipping_base_distance_km);
    if (body.shipping_base_fee !== undefined) row.shippingBaseFee = body.shipping_base_fee;
    if (body.shipping_per_km_fee !== undefined) row.shippingPerKmFee = body.shipping_per_km_fee;
    if (body.shipping_free_distance_km !== undefined) row.shippingFreeDistanceKm = String(body.shipping_free_distance_km);
    if (body.shipping_first_band_end_km !== undefined) row.shippingFirstBandEndKm = String(body.shipping_first_band_end_km);
    if (body.shipping_first_band_fee !== undefined) row.shippingFirstBandFee = body.shipping_first_band_fee;
    if (body.shipping_distance_step_km !== undefined) row.shippingDistanceStepKm = String(body.shipping_distance_step_km);
    if (body.shipping_distance_step_fee !== undefined) row.shippingDistanceStepFee = body.shipping_distance_step_fee;
    if (body.shipping_express_fee !== undefined) row.shippingExpressFee = body.shipping_express_fee;
    if (body.shipping_rounding_increment !== undefined) row.shippingRoundingIncrement = body.shipping_rounding_increment;
    if (body.shipping_volume_tiers !== undefined) {
      const tiers = body.shipping_volume_tiers.map((tier) => ({ max_m3: tier.max_m3 ?? null, fee: tier.fee })).sort((a, b) => (a.max_m3 ?? Infinity) - (b.max_m3 ?? Infinity));
      if (!tiers.length || tiers.some((tier, index) => index > 0 && tier.max_m3 !== null && tier.max_m3 <= (tiers[index - 1].max_m3 ?? -Infinity))) {
        throw new BadRequestException('Các ngưỡng phụ phí thể tích phải tăng dần.');
      }
      if (tiers.some((tier) => tier.max_m3 === null) && tiers[tiers.length - 1].max_m3 !== null) throw new BadRequestException('Ngưỡng không giới hạn phải nằm cuối bảng.');
      row.shippingVolumeTiers = tiers;
    }
    if (body.shipping_weight_fee_per_kg !== undefined) row.shippingWeightFeePerKg = body.shipping_weight_fee_per_kg;
    if (body.shipping_additional_delay_minutes !== undefined) row.shippingAdditionalDelayMinutes = body.shipping_additional_delay_minutes;
    if (body.shipping_preparation_minutes !== undefined) row.shippingPreparationMinutes = body.shipping_preparation_minutes;
    if (body.shipping_handover_minutes !== undefined) row.shippingHandoverMinutes = body.shipping_handover_minutes;
    if (body.shipping_fallback_speed_kmh !== undefined) row.shippingFallbackSpeedKmh = String(body.shipping_fallback_speed_kmh);
    if (body.delivery_day_start !== undefined) row.deliveryDayStart = body.delivery_day_start;
    if (body.delivery_day_end !== undefined) row.deliveryDayEnd = body.delivery_day_end;
    if (body.avg_speed_kmh !== undefined) row.avgSpeedKmh = String(body.avg_speed_kmh);
    if (body.road_factor !== undefined) row.roadFactor = String(body.road_factor);
    if (body.weight_km !== undefined) row.weightKm = String(body.weight_km);
    if (body.weight_time !== undefined) row.weightTime = String(body.weight_time);
    if (body.bank_name !== undefined) row.bankName = body.bank_name;
    if (body.bank_account_name !== undefined) row.bankAccountName = body.bank_account_name;
    if (body.bank_account_number !== undefined) row.bankAccountNumber = body.bank_account_number;
    if (body.bank_transfer_prefix !== undefined) row.bankTransferPrefix = body.bank_transfer_prefix;
    if (body.warranty_contact !== undefined) row.warrantyContact = body.warranty_contact;
    const rateChanged = previousRate !== normalizedShippingSettings(row);
    if (rateChanged) row.shippingRateVersion = Number(row.shippingRateVersion ?? 0) + 1;
    const saved = await repo.save(row);
    if (rateChanged) {
      const snapshot = await this.settings();
      await this.db.query('INSERT INTO shipping_rate_history (version, snapshot) VALUES (?, ?)', [saved.shippingRateVersion, JSON.stringify({ shipping: snapshot.shipping, optimization: snapshot.optimization, express: snapshot.express })]);
    }
    return this.settings();
  }

  async shippingRateHistory() {
    const rows = await this.db.query('SELECT id,version,snapshot,created_at FROM shipping_rate_history ORDER BY id DESC LIMIT 50');
    return rows.map((row: any) => ({
      id: Number(row.id), version: Number(row.version),
      snapshot: typeof row.snapshot === 'string' ? JSON.parse(row.snapshot) : row.snapshot,
      created_at: row.created_at,
    }));
  }
}
