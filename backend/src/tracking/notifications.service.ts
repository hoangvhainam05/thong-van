import { ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { MaintenanceService } from '../maintenance/maintenance.service';

const EVENT_FILTER = "(h.event_type='INFO_REQUEST' OR (h.event_type='STATUS' AND h.to_value IN ('PENDING','CONFIRMED','READY','SCHEDULED','OUT_FOR_DELIVERY','DELIVERED','FAILED','CANCELLED')))";
const LABELS: Record<string,string> = { PENDING:'Đã nhận đơn',CONFIRMED:'Đơn đã được xác nhận',READY:'Hàng đã sẵn sàng',SCHEDULED:'Đơn đã được xếp lịch',OUT_FOR_DELIVERY:'Xe đã xuất phát',DELIVERED:'Giao hàng thành công',FAILED:'Giao hàng chưa thành công',CANCELLED:'Đơn đã hủy' };
@Injectable()
export class NotificationsService {
  constructor(private readonly db: DataSource, private readonly maintenance:MaintenanceService) {}
  private async account(userId:number) {
    const [user] = await this.db.query('SELECT customer_id,notifications_enabled_at FROM `user` WHERE id=? AND active=1',[userId]);
    if (!user?.customer_id) throw new ForbiddenException('Tài khoản chưa liên kết với khách hàng');
    return user;
  }
  async list(userId:number) {
    const user = await this.account(userId);
    if (!user.notifications_enabled_at) return { enabled:false, notifications:[], unread:0 };
    const rows = await this.db.query(`SELECT h.id,h.event_type,h.to_value,h.note,h.created_at,o.id order_id,o.code, (r.history_id IS NOT NULL) is_read FROM order_history h JOIN orders o ON o.id=h.order_id JOIN \`user\` u ON u.id=? AND u.active=1 AND u.customer_id=o.customer_id LEFT JOIN user_notification_read r ON r.user_id=u.id AND r.history_id=h.id WHERE u.notifications_enabled_at IS NOT NULL AND h.created_at>=u.notifications_enabled_at AND ${EVENT_FILTER} ORDER BY h.id DESC LIMIT 100`,[userId]);
    const notifications = rows.map((row:{id:number;event_type:string;to_value:string;note:string|null;created_at:Date;order_id:number;code:string;is_read:number}) => ({id:row.id,order_id:row.order_id,code:row.code,title:row.event_type==='INFO_REQUEST'?'Cần bổ sung thông tin':LABELS[row.to_value] || 'Cập nhật đơn hàng',body:row.event_type==='INFO_REQUEST' || ['FAILED','CANCELLED'].includes(row.to_value) ? row.note : null,at:row.created_at,read:Boolean(row.is_read)}));
    const [count] = await this.db.query(`SELECT COUNT(*) AS count FROM order_history h JOIN orders o ON o.id=h.order_id JOIN \`user\` u ON u.id=? AND u.active=1 AND u.customer_id=o.customer_id LEFT JOIN user_notification_read r ON r.user_id=u.id AND r.history_id=h.id WHERE u.notifications_enabled_at IS NOT NULL AND h.created_at>=u.notifications_enabled_at AND r.history_id IS NULL AND ${EVENT_FILTER}`,[userId]);
    const reminders = await this.reminders(userId,user.customer_id);
    const combined = [...notifications, ...reminders].sort((a,b) => new Date(b.at).getTime()-new Date(a.at).getTime()).slice(0,100);
    return { enabled:true, notifications:combined, unread:Number(count.count)+reminders.filter((x:{read:boolean})=>!x.read).length };
  }
  async consent(userId:number,enabled:boolean) {
    await this.account(userId);
    await this.db.query(enabled ? 'UPDATE `user` SET notifications_enabled_at=COALESCE(notifications_enabled_at,NOW(6)) WHERE id=?' : 'UPDATE `user` SET notifications_enabled_at=NULL WHERE id=?',[userId]);
    return this.list(userId);
  }
  async markRead(userId:number) {
    const user=await this.account(userId);
    if (user.notifications_enabled_at) await this.db.query(`INSERT IGNORE INTO user_notification_read(user_id,history_id) SELECT u.id,h.id FROM order_history h JOIN orders o ON o.id=h.order_id JOIN \`user\` u ON u.id=? AND u.active=1 AND u.customer_id=o.customer_id WHERE u.notifications_enabled_at IS NOT NULL AND h.created_at>=u.notifications_enabled_at AND ${EVENT_FILTER}`,[userId]);
    if (user.notifications_enabled_at) {
      const reminders=await this.reminders(userId,user.customer_id);
      for (const reminder of reminders) await this.db.query('INSERT IGNORE INTO maintenance_reminder_read(user_id,order_item_id,cycle_no) VALUES(?,?,?)',[userId,reminder.item_id,reminder.cycle]);
    }
    return this.list(userId);
  }
  private async reminders(userId:number,customerId:number) {
    const [[clock], items] = await Promise.all([this.db.query("SELECT DATE_FORMAT(CURDATE(),'%Y-%m-%d') today"),this.maintenance.list(customerId)]);
    const today=String(clock.today);
    const shift=(day:string,days:number)=>{const d=new Date(`${day}T00:00:00Z`);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);};
    const lead=(months:number)=>months<=1?7:months<=3?14:30;
    const due=items.filter((item:{maintenance:{due_date:string;interval_months:number}|null})=>item.maintenance && item.maintenance.due_date<=shift(today,lead(item.maintenance.interval_months)));
    if (!due.length) return [];
    const reads=await this.db.query('SELECT order_item_id,cycle_no FROM maintenance_reminder_read WHERE user_id=? AND order_item_id IN (?)',[userId,due.map((item:{item_id:number})=>item.item_id)]);
    const readSet=new Set(reads.map((r:{order_item_id:number;cycle_no:number})=>`${r.order_item_id}:${r.cycle_no}`));
    return due.map((item:{item_id:number;order_id:number;code:string;product_name:string;maintenance:{cycle:number;due_date:string;interval_months:number}})=>({
      id:`maintenance:${item.item_id}:${item.maintenance.cycle}`,kind:'MAINTENANCE',item_id:item.item_id,cycle:item.maintenance.cycle,order_id:item.order_id,code:item.code,title:'Đến lịch bảo dưỡng',body:`${item.product_name} · lịch ${item.maintenance.due_date.split('-').reverse().join('/')}`,at:new Date(`${shift(item.maintenance.due_date,-lead(item.maintenance.interval_months))}T00:00:00Z`),read:readSet.has(`${item.item_id}:${item.maintenance.cycle}`),
    }));
  }
}
