// Dữ liệu thử riêng trên database phát triển; tự dọn khi kết thúc.
import 'dotenv/config';
import mysql from 'mysql2/promise';
import { createHash, randomBytes, scryptSync } from 'node:crypto';
const db=process.env.DATABASE_URL ? await mysql.createConnection(process.env.DATABASE_URL) : await mysql.createConnection({host:process.env.DB_HOST || '127.0.0.1',port:Number(process.env.DB_PORT || 3306),user:process.env.DB_USERNAME || 'thongvan',password:process.env.DB_PASSWORD || 'thongvan',database:process.env.DB_DATABASE || 'thongvan'});
const base=process.env.DELIVERY_TEST_BASE || 'http://127.0.0.1:18082';
const tag=randomBytes(5).toString('hex'), password='test-password-123';
const ids={users:[],drivers:[],vehicles:[],customers:[],orders:[],routes:[]};
let proofPublicId;
const date=n=>{const d=new Date();d.setDate(d.getDate()+n);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
async function req(path, method='GET',body,token,expected=200){const r=await fetch(base+path,{method,headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json().catch(()=>null);if(r.status!==expected)throw new Error(`${method} ${path}: expected ${expected} got ${r.status} ${JSON.stringify(data)}`);return data;}
function assert(c,m){if(!c)throw new Error(m);}
try {
 const day=date(180), retry=date(181);
 const [[used]]=await db.query('SELECT (SELECT COUNT(*) FROM route WHERE route_date IN (?,?))+(SELECT COUNT(*) FROM orders WHERE delivery_date IN (?,?)) n',[day,retry,day,retry]);
 assert(!used.n,'Ngày thử đã có dữ liệu, dừng để bảo vệ dữ liệu thật');
 const [[warehouse]]=await db.query('SELECT id FROM warehouse ORDER BY id LIMIT 1');
 const [[product]]=await db.query('SELECT id FROM product ORDER BY id LIMIT 1');
 assert(warehouse && product,'Cần kho và sản phẩm trong database');
 const [vehicle]=await db.query('INSERT INTO vehicle(plate,capacity_m3,capacity_kg) VALUES (?,10,5000)',[`T${tag}`]);ids.vehicles.push(vehicle.insertId);
 for(let i=0;i<2;i++){const [d]=await db.query('INSERT INTO driver(name,phone) VALUES (?,?)',[`Test ${tag} ${i}`,`09${String(Number.parseInt(tag.slice(0,7),16)+i).padStart(8,'0')}`]);ids.drivers.push(d.insertId);}
 const salt=randomBytes(16).toString('hex'),hash=`scrypt$${salt}$${scryptSync(password,salt,64).toString('hex')}`;
 for(const [i,role] of ['ADMIN','DRIVER','DRIVER'].entries()){const [u]=await db.query('INSERT INTO `user`(name,email,password_hash,role_id,driver_id) SELECT ?,?,?,id,? FROM role WHERE code=?',[`test ${tag}`,`test-${tag}-${i}@example.test`,hash,i?ids.drivers[i-1]:null,role]);ids.users.push(u.insertId);}
 const tokens=[];for(let i=0;i<3;i++) tokens.push((await req('/api/auth/login','POST',{identifier:`test-${tag}-${i}@example.test`,password},null,201)).token);
 for(let i=0;i<2;i++){
  const phone=`08${String(Number.parseInt(tag.slice(0,7),16)+i).padStart(8,'0')}`;
  const [c]=await db.query('INSERT INTO customer(name,phone) VALUES (?,?)',[`test ${tag}`,phone]);ids.customers.push(c.insertId);
  const [o]=await db.query("INSERT INTO orders(code,customer_id,address,lat,lng,delivery_date,total,subtotal,payment_method,payment_status,status) VALUES (?,?,?,?,?,?,?,?,?,?,?)",[`T${tag}${i}`,c.insertId,'Test address',21.03+i/1000,105.85,day,500000,500000,'COD','UNPAID','SCHEDULED']);ids.orders.push(o.insertId);
  await db.query('INSERT INTO order_item(order_id,product_id,quantity,unit_price) VALUES (?,?,1,500000)',[o.insertId,product.id]);
 }
 const [route]=await db.query("INSERT INTO route(route_date,warehouse_id,driver_id,vehicle_id,status,total_minutes) VALUES(?,?,?,?,?,60)",[day,warehouse.id,ids.drivers[0],vehicle.insertId,'LOCKED']);ids.routes.push(route.insertId);
 const stops=[];for(let i=0;i<2;i++){const [s]=await db.query('INSERT INTO delivery_stop(route_id,order_id,sequence,eta_start,eta_end,planned_arrival) VALUES(?,?,?, ?,?,?)',[route.insertId,ids.orders[i],i+1,`${day} 09:00:00`,`${day} 10:00:00`,`${day} 09:30:00`]);stops.push(s.insertId);}
 const mine=await req(`/api/driver/routes?route_date=${day}`,'GET',null,tokens[1]);assert(mine.length===1 && mine[0].stops.length===2,'Tài xế không thấy tuyến được giao');
 const other=await req(`/api/driver/routes?route_date=${day}`,'GET',null,tokens[2]);assert(other.length===0,'Lộ tuyến tài xế khác');
 await req(`/api/driver/routes/${route.insertId}/start`,'POST',null,tokens[2],403);
 await req(`/api/driver/stops/${stops[0]}/arrive`,'POST',null,tokens[1],409);
 await req(`/api/driver/routes/${route.insertId}/start`,'POST',null,tokens[1],201);
 await req(`/api/driver/stops/${stops[1]}/arrive`,'POST',null,tokens[1],409);
 await req(`/api/driver/stops/${stops[0]}/arrive`,'POST',null,tokens[2],403);
 await req(`/api/driver/stops/${stops[0]}/complete`,'POST',{success:true,cod_collected:500000},tokens[1],409);
 await req(`/api/driver/stops/${stops[0]}/arrive`,'POST',null,tokens[1],201);
 if (process.env.DELIVERY_TEST_CLOUDINARY === '1') {
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5i8AAAAASUVORK5CYII=','base64');
  const form=new FormData();form.append('file',new Blob([png],{type:'image/png'}),'test.png');
  const uploaded=await fetch(`${base}/api/driver/stops/${stops[0]}/proof`,{method:'POST',headers:{authorization:`Bearer ${tokens[1]}`},body:form});
  const response=await uploaded.json().catch(()=>null);if(uploaded.status!==201)throw new Error(`Tải ảnh thất bại: ${uploaded.status} ${JSON.stringify(response)}`);
  const [[proof]]=await db.query('SELECT proof_public_id FROM delivery_stop WHERE id=?',[stops[0]]);proofPublicId=proof.proof_public_id;
  assert(proofPublicId,'Chưa lưu ảnh bằng chứng');
  const publicDownload=await fetch(`https://res.cloudinary.com/${encodeURIComponent(process.env.CLOUDINARY_CLOUD_NAME)}/image/authenticated/${proofPublicId}.png`);
  assert(!publicDownload.ok,'Ảnh bằng chứng có thể truy cập công khai');
  await req(`/api/driver/stops/${stops[0]}/proof`,'GET',null,tokens[2],403);
  const signed=await req(`/api/driver/stops/${stops[0]}/proof`,'GET',null,tokens[1]);
  const download=await fetch(signed.url);assert(download.ok && (download.headers.get('content-type')||'').startsWith('image/'),'Không tải được ảnh bằng liên kết có hạn');
 }
 await req(`/api/driver/stops/${stops[0]}/complete`,'POST',{success:true,cod_collected:0},tokens[1],400);
 await req(`/api/driver/stops/${stops[0]}/complete`,'POST',{success:true,cod_collected:500000},tokens[1],201);
 const [[paid]]=await db.query('SELECT status,payment_status FROM orders WHERE id=?',[ids.orders[0]]);assert(paid.status==='DELIVERED'&&paid.payment_status==='PAID','COD chưa ghi đúng');
 await req(`/api/driver/stops/${stops[1]}/arrive`,'POST',null,tokens[1],201);
 await req(`/api/driver/stops/${stops[1]}/complete`,'POST',{success:false},tokens[1],400);
 const completed=await req(`/api/driver/stops/${stops[1]}/complete`,'POST',{success:false,note:'Không liên lạc được',cod_collected:0},tokens[1],201);assert(completed.status==='DONE','Tuyến chưa hoàn tất');
 const [[customer]]=await db.query('SELECT phone FROM customer WHERE id=?',[ids.customers[1]]);
 const tracking=await req(`/api/tracking/T${tag}1?phone=${customer.phone}`);assert(tracking.message.includes('Không liên lạc được'),'Thiếu lý do giao thất bại');
 await req(`/api/tracking/T${tag}1?phone=0000000000`,'GET',null,null,404);
 await req(`/api/orders/${ids.orders[1]}/reschedule`,'POST',{delivery_date:retry},tokens[0],201);
 const waiting=await req(`/api/tracking/T${tag}1?phone=${customer.phone}`);assert(waiting.status==='READY' && waiting.position===null,'Tracking vẫn hiển thị tuyến cũ sau khi hẹn lại');
 const optimized=await req('/api/routes/optimize','POST',{date:retry,vehicle_ids:[vehicle.insertId]},tokens[0],201);
 assert(optimized.routes.length===1 && optimized.routes[0].stops[0].order_id===ids.orders[1],'Không xếp lại được đơn thất bại');ids.routes.push(optimized.routes[0].id);
 const [attempts]=await db.query('SELECT result,sequence,route_id FROM delivery_stop WHERE order_id=? ORDER BY id',[ids.orders[1]]);
 assert(attempts.length===2&&attempts[0].result==='FAILED'&&attempts[0].route_id===route.insertId&&attempts[0].sequence===2,'Không bảo toàn lịch sử tuyến cũ');
 const trackRetry=await req(`/api/tracking/T${tag}1?phone=${customer.phone}`);assert(trackRetry.status==='SCHEDULED','Tracking không chọn lần giao mới');
 console.log('Kiểm thử giao hàng, phân quyền, COD, thất bại và xếp lại thành công.');
} finally {
 if(proofPublicId){
  const params={public_id:proofPublicId,timestamp:String(Math.floor(Date.now()/1000)),type:'authenticated'};
  const signature=createHash('sha1').update(Object.entries(params).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('&')+process.env.CLOUDINARY_API_SECRET).digest('hex');
  const body=new URLSearchParams({...params,api_key:process.env.CLOUDINARY_API_KEY,signature});
  try { const response=await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(process.env.CLOUDINARY_CLOUD_NAME)}/image/destroy`,{method:'POST',body});
    if(!response.ok) console.error('Không xóa được ảnh thử khỏi Cloudinary; cần kiểm tra theo public ID:',proofPublicId);
  } catch { console.error('Không xóa được ảnh thử khỏi Cloudinary; cần kiểm tra theo public ID:',proofPublicId); }
 }
 for(const id of ids.vehicles)await db.query('DELETE FROM route WHERE vehicle_id=?',[id]);
 for(const id of ids.orders){await db.query('DELETE FROM order_history WHERE order_id=?',[id]);await db.query('DELETE FROM order_item WHERE order_id=?',[id]);await db.query('DELETE FROM orders WHERE id=?',[id]);}
 for(const id of ids.users){await db.query('DELETE FROM audit_event WHERE user_id=?',[id]);await db.query('DELETE FROM `user` WHERE id=?',[id]);}
 for(const id of ids.customers)await db.query('DELETE FROM customer WHERE id=?',[id]);
 for(const id of ids.drivers)await db.query('DELETE FROM driver WHERE id=?',[id]);
 for(const id of ids.vehicles)await db.query('DELETE FROM vehicle WHERE id=?',[id]);
 await db.end();
}
