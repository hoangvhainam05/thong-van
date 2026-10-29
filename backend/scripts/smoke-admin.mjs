// Kiểm thử riêng trên database phát triển. Không đụng đến đơn/tuyến có sẵn.
import 'dotenv/config';
import mysql from 'mysql2/promise';
import { randomBytes,scryptSync } from 'node:crypto';
const db=process.env.DATABASE_URL?await mysql.createConnection(process.env.DATABASE_URL):await mysql.createConnection({host:process.env.DB_HOST||'127.0.0.1',port:Number(process.env.DB_PORT||3306),user:process.env.DB_USERNAME||'thongvan',password:process.env.DB_PASSWORD||'thongvan',database:process.env.DB_DATABASE||'thongvan'});
const base=process.env.ADMIN_TEST_BASE||'http://127.0.0.1:18084',tag=randomBytes(5).toString('hex'),password='Admin-test-password-123';
const ids={users:[],customers:[],orders:[],drivers:[],vehicles:[],routes:[]};
const date=n=>{const d=new Date();d.setDate(d.getDate()+n);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
function assert(c,m){if(!c)throw new Error(m);}
async function req(path,method='GET',body,token,expected=200){const r=await fetch(base+path,{method,headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json().catch(()=>null);if(r.status!==expected)throw new Error(`${method} ${path} expected ${expected} got ${r.status}: ${JSON.stringify(data)}`);return data;}
try {
 const day1=date(390),day2=date(391), [[used]]=await db.query('SELECT (SELECT COUNT(*) FROM orders WHERE delivery_date IN (?,?))+(SELECT COUNT(*) FROM route WHERE route_date IN (?,?))+(SELECT COUNT(*) FROM delivery_stop WHERE DATE(completed_at) IN (?,?)) n',[day1,day2,day1,day2,day1,day2]);assert(!used.n,'Ngày thử đã có dữ liệu');
 const [[wh]]=await db.query('SELECT id FROM warehouse ORDER BY id LIMIT 1'),[[product]]=await db.query('SELECT id FROM product ORDER BY id LIMIT 1');assert(wh&&product,'Thiếu kho hoặc sản phẩm');
 const salt=randomBytes(16).toString('hex'),hash=`scrypt$${salt}$${scryptSync(password,salt,64).toString('hex')}`;
 for(let i=0;i<2;i++){const [u]=await db.query('INSERT INTO `user`(name,email,password_hash,role_id) SELECT ?,?,?,id FROM role WHERE code=?',[`Admin test ${tag}`,`s6-${tag}-${i}@example.test`,hash,i?'SALES':'ADMIN']);ids.users.push(u.insertId);}
 const admin=(await req('/api/auth/login','POST',{identifier:`s6-${tag}-0@example.test`,password},null,201)).token;
 const sales=(await req('/api/auth/login','POST',{identifier:`s6-${tag}-1@example.test`,password},null,201)).token;
 await req(`/api/admin/reports?from=${day1}&to=${day2}`,'GET',null,null,401);
 await req(`/api/admin/reports?from=${day1}&to=${day2}`,'GET',null,sales,403);
 await req('/api/admin/audit','GET',null,sales,403);
 await req('/api/admin/settings','GET',null,sales,403);
 await req('/api/admin/reports?from=2026-99-01&to=2026-99-02','GET',null,admin,400);
 const [customer]=await db.query('INSERT INTO customer(name,phone) VALUES(?,?)',[`S6 test ${tag}`,`07${String(parseInt(tag.slice(0,6),16)).padStart(8,'0')}`]);ids.customers.push(customer.insertId);
 for(let i=0;i<2;i++){
   const [order]=await db.query("INSERT INTO orders(code,customer_id,address,delivery_date,time_window_start,time_window_end,total,subtotal,payment_method,payment_status,status) VALUES(?,?,?,?,'08:00:00','17:00:00',500000,500000,'COD','UNPAID',?)",[`S6${tag}${i}`,customer.insertId,'Test address',day2,i?'PENDING':'DELIVERED']);ids.orders.push(order.insertId);await db.query('INSERT INTO order_item(order_id,product_id,quantity,unit_price) VALUES(?,?,1,500000)',[order.insertId,product.id]);
   const [driver]=await db.query('INSERT INTO driver(name,phone) VALUES(?,?)',[`S6 ${tag} ${i}`,'0900000000']);ids.drivers.push(driver.insertId);
   const [vehicle]=await db.query('INSERT INTO vehicle(plate,capacity_m3,capacity_kg) VALUES(?,5,1000)',[`S6${tag}${i}`]);ids.vehicles.push(vehicle.insertId);
   const [route]=await db.query("INSERT INTO route(route_date,warehouse_id,driver_id,vehicle_id,status,total_km,baseline_km,total_minutes) VALUES(?,?,?,?,'DONE',?,?,60)",[i?day2:day1,wh.id,driver.insertId,vehicle.insertId,i?70:50,i?60:100]);ids.routes.push(route.insertId);
   const at=`${i?day2:day1} 09:30:00`;
   await db.query('INSERT INTO delivery_stop(route_id,order_id,sequence,eta_start,eta_end,planned_arrival,actual_arrival,completed_at,result,result_note) VALUES(?,?,1,?,?,?,?,?,?,?)',[route.insertId,ids.orders[0],at,at,at,at,at,i?'DELIVERED':'FAILED',i?null:'Không gặp khách']);
 }
 await req(`/api/orders/${ids.orders[1]}/status`,'PATCH',{status:'CANCELLED',reason:'Kiểm thử'},admin);
 const report=await req(`/api/admin/reports?from=${day1}&to=${day2}`,'GET',null,admin);const t=report.totals;
 assert(t.orders===2&&t.delivered_orders===1&&t.cancelled===1&&t.revenue===500000,`Sai số đơn/doanh thu: ${JSON.stringify(t)}`);
 assert(t.attempts===2&&t.delivered_attempts===1&&t.failed_attempts===1&&t.timed===1&&t.on_time===1&&t.failure_rate===0.5,'Sai thống kê giao hàng');
 assert(t.routes===2&&t.planned_km===120&&t.baseline_km===160&&t.saved_km===40,'Sai thống kê km tuyến');
 const dashboard=await req(`/api/admin/dashboard?date=${day2}`,'GET',null,sales);assert(dashboard.totals.orders===2,'Sai dashboard');
 const customers=await req('/api/admin/customers','GET',null,admin);const c=customers.find(row=>row.id===customer.insertId);assert(c&&c.orders===2&&c.spent===500000,'Sai tổng khách hàng');
 const audit=await req('/api/admin/audit?limit=200','GET',null,admin);const event=audit.items.find(x=>x.user_id===ids.users[0]&&x.path===`/api/orders/${ids.orders[1]}/status`);assert(event&&event.method==='PATCH'&&event.details?.status==='CANCELLED','Thiếu nhật ký thay đổi trạng thái');assert(!JSON.stringify(audit.items.filter(x=>x.user_id===ids.users[0])).includes(password),'Nhật ký lộ mật khẩu');
 await req(`/api/orders/${ids.orders[0]}`,'GET',null,sales);
 console.log('Kiểm thử báo cáo, phân quyền, khách hàng và nhật ký thành công.');
} finally {
 for(const id of ids.users)await db.query('DELETE FROM audit_event WHERE user_id=?',[id]);
 for(const id of ids.routes)await db.query('DELETE FROM route WHERE id=?',[id]);
 for(const id of ids.orders){await db.query('DELETE FROM order_history WHERE order_id=?',[id]);await db.query('DELETE FROM order_item WHERE order_id=?',[id]);await db.query('DELETE FROM orders WHERE id=?',[id]);}
 for(const id of ids.users)await db.query('DELETE FROM `user` WHERE id=?',[id]);for(const id of ids.customers)await db.query('DELETE FROM customer WHERE id=?',[id]);for(const id of ids.drivers)await db.query('DELETE FROM driver WHERE id=?',[id]);for(const id of ids.vehicles)await db.query('DELETE FROM vehicle WHERE id=?',[id]);await db.end();
}
