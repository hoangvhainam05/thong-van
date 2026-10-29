import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager } from 'typeorm';

// Lịch neo vào ngày giao, tháng ngắn được chốt ở ngày cuối tháng.
export function addCalendarMonths(date:string, months:number):string {
  const [y,m,d]=date.split('-').map(Number);
  const monthIndex=y*12+m-1+months, year=Math.floor(monthIndex/12), month=monthIndex%12;
  const last=new Date(Date.UTC(year,month+1,0)).getUTCDate();
  return `${String(year).padStart(4,'0')}-${String(month+1).padStart(2,'0')}-${String(Math.min(d,last)).padStart(2,'0')}`;
}
export function nextMaintenance(start:string,interval:number,lastCycle:number,lastCompleted:string|null) {
  let cycle=Math.max(1,lastCycle+1);
  while (lastCompleted && addCalendarMonths(start,interval*cycle)<=lastCompleted) {
    cycle++;
    if (cycle>10000) throw new BadRequestException('Không tính được lịch bảo dưỡng');
  }
  return {cycle, due_date:addCalendarMonths(start,interval*cycle)};
}
@Injectable()
export class MaintenanceService {
  constructor(private readonly db:DataSource,private readonly config:ConfigService) {}
  async list(customerId:number|null,manager?:EntityManager) {
    if (!customerId) throw new ForbiddenException('Tài khoản chưa liên kết với khách hàng');
    const query=manager || this.db;
    const [[clock],rows]=await Promise.all([
      query.query("SELECT DATE_FORMAT(CURDATE(),'%Y-%m-%d') today"),
      query.query(`SELECT i.id item_id,i.order_id,i.quantity,i.warranty_months_snapshot warranty_months,i.maintenance_interval_months_snapshot maintenance_months,p.name product_name,o.code,DATE_FORMAT(s.completed_at,'%Y-%m-%d') delivered_date,
        COALESCE((SELECT MAX(m.cycle_no) FROM maintenance_record m WHERE m.order_item_id=i.id),0) last_cycle,
        (SELECT DATE_FORMAT(m.completed_date,'%Y-%m-%d') FROM maintenance_record m WHERE m.order_item_id=i.id ORDER BY m.cycle_no DESC LIMIT 1) last_completed
        FROM order_item i JOIN orders o ON o.id=i.order_id JOIN product p ON p.id=i.product_id JOIN delivery_stop s ON s.id=(SELECT ds.id FROM delivery_stop ds WHERE ds.order_id=o.id AND ds.result='DELIVERED' ORDER BY ds.id DESC LIMIT 1)
        WHERE o.customer_id=? AND o.status='DELIVERED' ORDER BY s.completed_at DESC,i.id`,[customerId]),
    ]);
    const today=String(clock.today),contact=this.config.get<string>('warranty.contact','').trim() || null;
    return rows.map((r:{item_id:number;order_id:number;quantity:number;warranty_months:number|null;maintenance_months:number|null;product_name:string;code:string;delivered_date:string;last_cycle:number|string;last_completed:string|null})=>{
      const months=r.warranty_months===null?null:Number(r.warranty_months);
      const expires=months!==null && months>0?addCalendarMonths(r.delivered_date,months):null;
      const maintenance=r.maintenance_months ? {...nextMaintenance(r.delivered_date,Number(r.maintenance_months),Number(r.last_cycle),r.last_completed),interval_months:Number(r.maintenance_months),last_completed:r.last_completed} : null;
      return {item_id:r.item_id,order_id:r.order_id,code:r.code,product_name:r.product_name,quantity:r.quantity,delivered_date:r.delivered_date,warranty_months:months,warranty_end_exclusive:expires,warranty_status:months===null?'UNKNOWN':months===0?'NONE':today<expires!?'ACTIVE':'EXPIRED',maintenance,contact};
    });
  }
  async record(userId:number,customerId:number|null,itemId:number,cycle:number) {
    if (!customerId) throw new ForbiddenException('Tài khoản chưa liên kết với khách hàng');
    return this.db.transaction(async manager=>{
      const [item]=await manager.query("SELECT i.id FROM order_item i JOIN orders o ON o.id=i.order_id WHERE i.id=? AND o.customer_id=? AND o.status='DELIVERED' FOR UPDATE",[itemId,customerId]);
      if(!item) throw new NotFoundException('Không tìm thấy sản phẩm');
      const row=(await this.list(customerId,manager)).find((x:{item_id:number})=>x.item_id===itemId);
      if(!row?.maintenance) throw new ConflictException('Sản phẩm chưa có chu kỳ bảo dưỡng');
      if(row.maintenance.cycle!==cycle) throw new ConflictException('Lịch đã thay đổi; vui lòng tải lại');
      await manager.query('INSERT INTO maintenance_record(order_item_id,cycle_no,due_date,completed_date,recorded_by) VALUES(?,?,?,CURDATE(),?)',[itemId,cycle,row.maintenance.due_date,userId]);
      return {recorded:true};
    });
  }
}
