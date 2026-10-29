// Dùng database phát triển; chỉ tạo và dọn bản ghi riêng của lần chạy.
import 'dotenv/config';
import mysql from 'mysql2/promise';
import { createHash, randomBytes, scryptSync } from 'node:crypto';
const db=process.env.DATABASE_URL?await mysql.createConnection(process.env.DATABASE_URL):await mysql.createConnection({host:process.env.DB_HOST||'127.0.0.1',port:Number(process.env.DB_PORT||3306),user:process.env.DB_USERNAME||'thongvan',password:process.env.DB_PASSWORD||'thongvan',database:process.env.DB_DATABASE||'thongvan'});
const base=process.env.TRACKING_TEST_BASE||'http://127.0.0.1:18083',tag=randomBytes(5).toString('hex'),password='Tracking-test-123';
const ids={users:[],customers:[],orders:[],drivers:[],vehicles:[],routes:[]};let proofPublicId;
const date=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
function assert(c,m){if(!c)throw new Error(m);}
async function req(path,method='GET',body,token,expected=200){const r=await fetch(base+path,{method,headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json().catch(()=>null);if(r.status!==expected)throw new Error(`${method} ${path}: expected ${expected}, got ${r.status}: ${JSON.stringify(data)}`);return data;}
try {
 const [[wh]]=await db.query('SELECT id FROM warehouse ORDER BY id LIMIT 1'),[[product]]=await db.query('SELECT id FROM product ORDER BY id LIMIT 1');assert(wh&&product,'Thiếu kho hoặc sản phẩm');
 const [driver]=await db.query('INSERT INTO driver(name,phone) VALUES (?,?)',[`Sprint5 ${tag}`,'0900000000']);ids.drivers.push(driver.insertId);
 const [vehicle]=await db.query('INSERT INTO vehicle(plate,capacity_m3,capacity_kg) VALUES(?,5,1000)',[`S${tag}`]);ids.vehicles.push(vehicle.insertId);
 const salt=randomBytes(16).toString('hex'),hash=`scrypt$${salt}$${scryptSync(password,salt,64).toString('hex')}`,phones=[];
 for(let i=0;i<2;i++){
  const phone=`08${String(parseInt(tag.slice(0,6),16)+i).padStart(8,'0')}`;phones.push(phone);
  const [customer]=await db.query('INSERT INTO customer(name,phone) VALUES(?,?)',[`Private customer ${tag} ${i}`,phone]);ids.customers.push(customer.insertId);
  const [user]=await db.query("INSERT INTO `user`(name,email,phone,password_hash,role_id,customer_id) SELECT ?,?,?,?,id,? FROM role WHERE code='CUSTOMER'",[`Test customer ${i}`,`s5-${tag}-${i}@example.test`,phone,hash,customer.insertId]);ids.users.push(user.insertId);
  const [order]=await db.query("INSERT INTO orders(code,customer_id,address,lat,lng,delivery_date,total,subtotal,payment_method,payment_status,status) VALUES(?,?,?,?,?,CURDATE(),?,?, 'COD','UNPAID','SCHEDULED')",[`S5${tag}${i}`,customer.insertId,`Secret address ${tag} ${i}`,21.03,105.85,500000,500000]);ids.orders.push(order.insertId);
  await db.query('INSERT INTO order_item(order_id,product_id,quantity,unit_price) VALUES(?,?,1,500000)',[order.insertId,product.id]);
 }
 const [driverUser]=await db.query("INSERT INTO `user`(name,email,password_hash,role_id,driver_id) SELECT ?,?,?,id,? FROM role WHERE code='DRIVER'",[`Test driver ${tag}`,`s5-${tag}-driver@example.test`,hash,driver.insertId]);ids.users.push(driverUser.insertId);
 const tokens=[];for(let i=0;i<3;i++){const email=i===2?`s5-${tag}-driver@example.test`:`s5-${tag}-${i}@example.test`;tokens.push((await req('/api/auth/login','POST',{identifier:email,password},null,201)).token);}
 const [route]=await db.query("INSERT INTO route(route_date,warehouse_id,driver_id,vehicle_id,status,total_minutes) VALUES(CURDATE(),?,?,?,'LOCKED',120)",[wh.id,driver.insertId,vehicle.insertId]);ids.routes.push(route.insertId);
 const stops=[];for(let i=0;i<2;i++){const [stop]=await db.query('INSERT INTO delivery_stop(route_id,order_id,sequence,eta_start,eta_end,planned_arrival) VALUES(?,?,?,DATE_ADD(NOW(),INTERVAL 60 MINUTE),DATE_ADD(NOW(),INTERVAL 90 MINUTE),DATE_SUB(NOW(),INTERVAL 60 MINUTE))',[route.insertId,ids.orders[i],i+1]);stops.push(stop.insertId);}
 await req('/api/account/orders','GET',null,null,401);
 let list=await req('/api/account/orders','GET',null,tokens[0]);assert(list.length===1&&list[0].id===ids.orders[0],'Danh sách đơn không đúng quyền sở hữu');
 await req(`/api/account/orders/${ids.orders[1]}`,'GET',null,tokens[0],404);
 await req(`/api/account/orders/${ids.orders[1]}/proof`,'GET',null,tokens[0],404);
 await req(`/api/tracking/S5${tag}1`,'POST',{phone:phones[0]},null,404);
 const consentBefore=await req('/api/account/notifications','GET',null,tokens[0]);assert(!consentBefore.enabled&&consentBefore.notifications.length===0,'Chưa đồng ý vẫn có thông báo');
 await db.query("INSERT INTO order_history(order_id,event_type,to_value,actor) VALUES(?,'STATUS','PENDING','SYSTEM')",[ids.orders[0]]);
 await req('/api/account/notification-consent','PATCH',{enabled:true},tokens[0]);
 await req('/api/account/notification-consent','PATCH',{enabled:true},tokens[1]);
 assert((await req('/api/account/notifications','GET',null,tokens[0])).notifications.length===0,'Đã hiện sự kiện trước lúc đồng ý');
 await req(`/api/driver/routes/${route.insertId}/start`,'POST',null,tokens[2],201);
 const before=await req(`/api/tracking/S5${tag}1`,'POST',{phone:phones[1]});assert(before.stops_before===1,'Sai số điểm phía trước');
 assert(!JSON.stringify(before).includes(`Secret address ${tag} 0`) && !JSON.stringify(before).includes(`S5${tag}0`) && !JSON.stringify(before).includes(phones[0]),'Lộ thông tin đơn khác');
 await req(`/api/driver/stops/${stops[0]}/arrive`,'POST',null,tokens[2],201);
 if(process.env.TRACKING_TEST_CLOUDINARY==='1'){
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5i8AAAAASUVORK5CYII=','base64');const form=new FormData();form.append('file',new Blob([png],{type:'image/png'}),'test.png');const upload=await fetch(`${base}/api/driver/stops/${stops[0]}/proof`,{method:'POST',headers:{authorization:`Bearer ${tokens[2]}`},body:form});assert(upload.status===201,'Không tải được ảnh bằng chứng thử');const [[proof]]=await db.query('SELECT proof_public_id FROM delivery_stop WHERE id=?',[stops[0]]);proofPublicId=proof.proof_public_id;
  await req(`/api/tracking/S5${tag}0/proof`,'POST',{phone:phones[0]},null,404);
 }
 await req(`/api/driver/stops/${stops[0]}/complete`,'POST',{success:true,cod_collected:500000},tokens[2],201);
 const after=await req(`/api/tracking/S5${tag}1`,'POST',{phone:phones[1]});assert(after.stops_before===0,'Không giảm số điểm trước sau khi giao');assert(new Date(after.eta_start)-new Date(before.eta_start)>50*60000,'ETA không cập nhật theo tiến độ trễ');
 if(proofPublicId){await req(`/api/tracking/S5${tag}0/proof`,'POST',{phone:phones[1]},null,404);const proof=await req(`/api/tracking/S5${tag}0/proof`,'POST',{phone:phones[0]});assert((await fetch(proof.url)).ok,'Khách không xem được ảnh đúng đơn');await req(`/api/account/orders/${ids.orders[0]}/proof`,'GET',null,tokens[1],404);const own=await req(`/api/account/orders/${ids.orders[0]}/proof`,'GET',null,tokens[0]);assert((await fetch(own.url)).ok,'Tài khoản chủ đơn không xem được ảnh');}
 const n1=await req('/api/account/notifications','GET',null,tokens[0]),n2=await req('/api/account/notifications','GET',null,tokens[1]);assert(n1.unread>=2&&n2.unread>=1,'Chưa phát thông báo sự kiện');assert(n1.notifications.every(n=>n.order_id===ids.orders[0])&&n2.notifications.every(n=>n.order_id===ids.orders[1]),'Lộ thông báo khách khác');
 const read=await req('/api/account/notifications/read','POST',null,tokens[0],201);assert(read.unread===0,'Chưa đánh dấu đã đọc');assert((await req('/api/account/notifications','GET',null,tokens[1])).unread>0,'Đánh dấu đọc ảnh hưởng tài khoản khác');
 const disabled=await req('/api/account/notification-consent','PATCH',{enabled:false},tokens[0]);assert(!disabled.enabled&&disabled.notifications.length===0,'Tắt đồng ý không có hiệu lực');
 console.log('Kiểm thử tracking, ETA, quyền khách, ảnh và thông báo thành công.');
} finally {
 if(proofPublicId){const params={public_id:proofPublicId,timestamp:String(Math.floor(Date.now()/1000)),type:'authenticated'};const signature=createHash('sha1').update(Object.entries(params).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('&')+process.env.CLOUDINARY_API_SECRET).digest('hex');try{const response=await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(process.env.CLOUDINARY_CLOUD_NAME)}/image/destroy`,{method:'POST',body:new URLSearchParams({...params,api_key:process.env.CLOUDINARY_API_KEY,signature})});if(!response.ok)console.error('Không xóa được ảnh thử:',proofPublicId);}catch{console.error('Không xóa được ảnh thử:',proofPublicId);}}
 for(const id of ids.vehicles)await db.query('DELETE FROM route WHERE vehicle_id=?',[id]);
 for(const id of ids.orders){await db.query('DELETE FROM order_history WHERE order_id=?',[id]);await db.query('DELETE FROM order_item WHERE order_id=?',[id]);await db.query('DELETE FROM orders WHERE id=?',[id]);}
 for(const id of ids.users){await db.query('DELETE FROM audit_event WHERE user_id=?',[id]);await db.query('DELETE FROM `user` WHERE id=?',[id]);}for(const id of ids.customers)await db.query('DELETE FROM customer WHERE id=?',[id]);for(const id of ids.drivers)await db.query('DELETE FROM driver WHERE id=?',[id]);for(const id of ids.vehicles)await db.query('DELETE FROM vehicle WHERE id=?',[id]);await db.end();
}
