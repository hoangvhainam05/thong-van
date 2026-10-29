import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { SystemSetting } from '../database/entities';
import { UpdateSettingsDto } from './admin.dto';

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
    if (body.shipping_fee !== undefined) row.shippingFee = body.shipping_fee;
    if (body.free_ship_from !== undefined) row.freeShipFrom = body.free_ship_from;
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
    await repo.save(row);
    return this.settings();
  }
}
