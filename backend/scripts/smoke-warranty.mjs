// Dùng database phát triển; tạo và dọn dữ liệu của lần kiểm thử.
import 'dotenv/config';
import mysql from 'mysql2/promise';
import { randomBytes,scryptSync } from 'node:crypto';
const db=process.env.DATABASE_URL?await mysql.createConnection(process.env.DATABASE_URL):await mysql.createConnection({host:process.env.DB_HOST||'127.0.0.1',port:Number(process.env.DB_PORT||3306),user:process.env.DB_USERNAME||'thongvan',password:process.env.DB_PASSWORD||'thongvan',database:process.env.DB_DATABASE||'thongvan'});
const base=process.env.WARRANTY_TEST_BASE||'http://127.0.0.1:18085',tag=randomBytes(5).toString('hex'),password='Warranty-test-123';
const ids={users:[],customers:[],orders:[],routes:[],products:[],vehicles:[],drivers:[]};
function assert(condition,message){if(!condition)throw new Error(message);}
async function req(path,method='GET',body,token,expected=200){const r=await fetch(base+path,{method,headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json().catch(()=>null);if(r.status!==expected)throw new Error(`${method} ${path}: expected ${expected}, got ${r.status}: ${JSON.stringify(data)}`);return data;}
try {
 const [[warehouse]]=await db.query('SELECT id FROM warehouse ORDER BY id LIMIT 1');assert(warehouse,'Chưa có kho');
 const [product]=await db.query("INSERT INTO product(sku,name,category,price,volume_m3,weight_kg,install_minutes,warranty_months,maintenance_interval_months,stock) VALUES(?,?, 'test',500000,0.1,1,0,12,1,5)",[`WT-${tag}`,`Sản phẩm thử ${tag}`]);ids.products.push(product.insertId);
 const salt=randomBytes(16).toString('hex'),hash=`scrypt$${salt}$${scryptSync(password,salt,64).toString('hex')}`,phones=[];
 for(let i=0;i<2;i++){const phone=`06${String(parseInt(tag.slice(0,6),16)+i).padStart(8,'0')}`;phones.push(phone);const [customer]=await db.query('INSERT INTO customer(name,phone) VALUES(?,?)',[`Warranty test ${tag} ${i}`,phone]);ids.customers.push(customer.insertId);const [user]=await db.query("INSERT INTO `user`(name,email,phone,password_hash,role_id,customer_id) SELECT ?,?,?,?,id,? FROM role WHERE code='CUSTOMER'",[`Warranty customer ${i}`,`wt-${tag}-${i}@example.test`,phone,hash,customer.insertId]);ids.users.push(user.insertId);}
 const [adminUser]=await db.query("INSERT INTO `user`(name,email,password_hash,role_id) SELECT ?,?,?,id FROM role WHERE code='ADMIN'",[`Warranty admin ${tag}`,`wt-${tag}-admin@example.test`,hash]);ids.users.push(adminUser.insertId);
 const tokens=[];for(let i=0;i<3;i++){const email=i===2?`wt-${tag}-admin@example.test`:`wt-${tag}-${i}@example.test`;tokens.push((await req('/api/auth/login','POST',{identifier:email,password},null,201)).token);}
 const [[today]]=await db.query("SELECT DATE_FORMAT(CURDATE(),'%Y-%m-%d') today,DATE_FORMAT(DATE_SUB(CURDATE(),INTERVAL 2 MONTH),'%Y-%m-%d') delivery");
 const order=await req('/api/orders','POST',{customer_name:'Warranty test',phone:phones[0],address:'123 test address',delivery_date:today.today,payment_method:'COD',items:[{product_id:product.insertId,quantity:1}]},null,201);ids.orders.push(order.id);
 assert((await req('/api/account/warranties','GET',null,tokens[0])).length===0,'Đơn chưa giao không được có lịch bảo hành');
 assert(!(await req('/api/account/notifications','GET',null,tokens[0])).enabled,'Chưa đồng ý vẫn bật thông báo');
 await req(`/api/products/admin/${product.insertId}`,'PATCH',{warranty:24,maintenanceIntervalMonths:3},tokens[2]);
 const [[item]]=await db.query('SELECT id,warranty_months_snapshot,maintenance_interval_months_snapshot FROM order_item WHERE order_id=?',[order.id]);assert(item.warranty_months_snapshot===12&&item.maintenance_interval_months_snapshot===1,'Snapshot bị thay đổi sau khi sửa sản phẩm');
 const [oldOrder]=await db.query("INSERT INTO orders(code,customer_id,address,delivery_date,total,subtotal,payment_method,payment_status,status) VALUES(?,?,?,CURDATE(),1,1,'COD','PAID','DELIVERED')",[`WTO${tag}`,ids.customers[0],'Old test address']);ids.orders.push(oldOrder.insertId);
 const [oldItem]=await db.query('INSERT INTO order_item(order_id,product_id,quantity,unit_price) VALUES(?,?,1,1)',[oldOrder.insertId,product.insertId]);
 const [driver]=await db.query('INSERT INTO driver(name,phone) VALUES(?,?)',[`WT ${tag}`,'0900000000']);ids.drivers.push(driver.insertId);const [vehicle]=await db.query('INSERT INTO vehicle(plate,capacity_m3,capacity_kg) VALUES(?,5,1000)',[`WT${tag}`]);ids.vehicles.push(vehicle.insertId);
 const [route]=await db.query("INSERT INTO route(route_date,warehouse_id,driver_id,vehicle_id,status,total_minutes) VALUES(?,?,?,?,'DONE',60)",[today.delivery,warehouse.id,driver.insertId,vehicle.insertId]);ids.routes.push(route.insertId);
 await db.query("UPDATE orders SET status='DELIVERED',payment_status='PAID' WHERE id=?",[order.id]);
 for(const [seq,orderId] of [[1,order.id],[2,oldOrder.insertId]])await db.query("INSERT INTO delivery_stop(route_id,order_id,sequence,eta_start,eta_end,planned_arrival,actual_arrival,completed_at,result) VALUES(?,?,?,?,?,?,?,?, 'DELIVERED')",[route.insertId,orderId,seq,`${today.delivery} 09:00:00`,`${today.delivery} 10:00:00`,`${today.delivery} 09:30:00`,`${today.delivery} 09:30:00`,`${today.delivery} 09:45:00`]);
 const list=await req('/api/account/warranties','GET',null,tokens[0]);const current=list.find(x=>x.item_id===item.id),legacy=list.find(x=>x.item_id===oldItem.insertId);
 assert(current?.warranty_months===12 && current?.maintenance?.interval_months===1 && current.delivered_date===today.delivery,'Sai thời hạn hoặc ngày bắt đầu');
 assert(legacy?.warranty_status==='UNKNOWN' && legacy.maintenance===null,'Đơn cũ không được suy đoán thời hạn');
 assert((await req('/api/account/warranties','GET',null,tokens[1])).length===0,'Lộ dữ liệu bảo hành khách khác');
 await req(`/api/account/maintenance/${item.id}/complete`,'POST',{cycle:current.maintenance.cycle},tokens[1],404);
 await req(`/api/tracking/${order.code}`,'POST',{phone:phones[1]},null,404);
 const tracking=await req(`/api/tracking/${order.code}`,'POST',{phone:phones[0]});assert(tracking.items[0].warranty_months===12&&tracking.items[0].warranty_start===today.delivery,'Tracking không hiển thị bảo hành đúng snapshot');
 await req('/api/account/notification-consent','PATCH',{enabled:true},tokens[0]);
 const notices=await req('/api/account/notifications','GET',null,tokens[0]);assert(notices.notifications.some(n=>n.kind==='MAINTENANCE'&&n.item_id===item.id&&!n.read),'Không tạo nhắc bảo dưỡng khi đến hạn');
 const marked=await req('/api/account/notifications/read','POST',null,tokens[0],201);assert(marked.notifications.find(n=>n.kind==='MAINTENANCE')?.read,'Chưa lưu trạng thái đã đọc');
 const disabled=await req('/api/account/notification-consent','PATCH',{enabled:false},tokens[0]);assert(!disabled.enabled&&disabled.notifications.length===0,'Tắt thông báo không có hiệu lực');
 await req('/api/account/notification-consent','PATCH',{enabled:true},tokens[0]);
 const completePath=`${base}/api/account/maintenance/${item.id}/complete`;
 const simultaneous=await Promise.all([1,2].map(()=>fetch(completePath,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${tokens[0]}`},body:JSON.stringify({cycle:current.maintenance.cycle})})));
 assert(simultaneous.map(r=>r.status).sort().join(',')==='201,409','Không chống ghi trùng khi gửi đồng thời');
 await req(`/api/account/maintenance/${item.id}/complete`,'POST',{cycle:current.maintenance.cycle},tokens[0],409);
 const updated=(await req('/api/account/warranties','GET',null,tokens[0])).find(x=>x.item_id===item.id);
 assert(updated.maintenance.due_date>today.today && updated.maintenance.last_completed===today.today,'Không cập nhật chu kỳ sau khi tự ghi nhận bảo dưỡng');
 assert(!(await req('/api/account/notifications','GET',null,tokens[0])).notifications.some(n=>n.kind==='MAINTENANCE'&&n.item_id===item.id),'Nhắc cũ không được đóng');
 console.log('Kiểm thử bảo hành, lịch bảo dưỡng, nhắc việc và quyền khách thành công.');
} finally {
 for(const id of ids.users)await db.query('DELETE FROM audit_event WHERE user_id=?',[id]);
 for(const id of ids.routes)await db.query('DELETE FROM route WHERE id=?',[id]);
 for(const id of ids.orders){await db.query('DELETE FROM order_history WHERE order_id=?',[id]);await db.query('DELETE FROM order_item WHERE order_id=?',[id]);await db.query('DELETE FROM orders WHERE id=?',[id]);}
 for(const id of ids.users)await db.query('DELETE FROM `user` WHERE id=?',[id]);for(const id of ids.customers)await db.query('DELETE FROM customer WHERE id=?',[id]);for(const id of ids.drivers)await db.query('DELETE FROM driver WHERE id=?',[id]);for(const id of ids.vehicles)await db.query('DELETE FROM vehicle WHERE id=?',[id]);for(const id of ids.products)await db.query('DELETE FROM product WHERE id=?',[id]);await db.end();
}
