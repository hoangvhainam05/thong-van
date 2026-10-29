// Chỉ chạy trên database phát triển. Tự dọn các bản ghi thử ngay cả khi có lỗi.
import 'dotenv/config';
import mysql from 'mysql2/promise';
import { randomBytes, scryptSync } from 'node:crypto';
const db = process.env.DATABASE_URL ? await mysql.createConnection(process.env.DATABASE_URL) : await mysql.createConnection({host:process.env.DB_HOST || '127.0.0.1',port:Number(process.env.DB_PORT || 3306),user:process.env.DB_USERNAME || 'thongvan',password:process.env.DB_PASSWORD || 'thongvan',database:process.env.DB_DATABASE || 'thongvan'});
const base = process.env.AUTH_TEST_BASE || 'http://127.0.0.1:18081';
const tag = randomBytes(6).toString('hex');
const email = `test-${tag}@example.test`, roleCode = `TEST_${tag.toUpperCase()}`, password = 'test-password-123';
let adminId, testUserId, testRoleId, customerId;
async function req(path, method='GET', body, token, expected=200) {
  const r=await fetch(base+path,{method,headers:{'content-type':'application/json',...(token?{authorization:`Bearer ${token}`}:{})},...(body ? {body:JSON.stringify(body)} : {})});
  const data=await r.json().catch(()=>null);
  if(r.status!==expected) throw new Error(`${method} ${path}: expected ${expected}, got ${r.status}: ${JSON.stringify(data)}`);
  return data;
}
try {
  const salt=randomBytes(16).toString('hex'), hash=`scrypt$${salt}$${scryptSync(password,salt,64).toString('hex')}`;
  const [result]=await db.query("INSERT INTO `user` (name,email,password_hash,role_id) SELECT 'Test admin',?,?,id FROM role WHERE code='ADMIN'",[email,hash]); adminId=result.insertId;
  const admin=(await req('/api/auth/login','POST',{identifier:email,password},null,201)).token;
  await req('/api/users','GET',undefined,undefined,401);
  await req('/api/users','GET',undefined,admin);
  const role=await req('/api/roles','POST',{code:roleCode,name:'Test role',permissions:['backoffice.access']},admin,201); testRoleId=role.id;
  await req(`/api/roles/${role.id}`,'GET',undefined,admin);
  await req(`/api/roles/${role.id}`,'PATCH',{name:'Updated role',permissions:['backoffice.access','product.manage']},admin);
  const user=await req('/api/users','POST',{name:'Test user',email:`u-${email}`,password,role:roleCode},admin,201); testUserId=user.id;
  await req(`/api/users/${user.id}`,'GET',undefined,admin);
  const token=(await req('/api/auth/login','POST',{identifier:`u-${email}`,password},null,201)).token;
  await req('/api/users','GET',undefined,token,403);
  await req('/api/products/admin','GET',undefined,token);
  await req(`/api/roles/${role.id}`,'PATCH',{permissions:['backoffice.access']},admin);
  await req('/api/products/admin','GET',undefined,token,403);
  await req(`/api/roles/${role.id}`,'PATCH',{permissions:['backoffice.access','user.manage']},admin);
  const [[admins]] = await db.query("SELECT COUNT(*) count FROM `user` u JOIN role r ON r.id=u.role_id WHERE r.code='ADMIN' AND u.active=1");
  if (Number(admins.count) === 1) await req(`/api/users/${adminId}`,'DELETE',undefined,token,403);
  await req(`/api/users/${user.id}`,'PATCH',{active:false},admin);
  await req('/api/auth/me','GET',undefined,token,401);
  await db.query('DELETE FROM audit_event WHERE user_id=?',[testUserId]);
  await req(`/api/users/${user.id}`,'DELETE',undefined,admin); testUserId=undefined;
  await req(`/api/roles/${role.id}`,'DELETE',undefined,admin); testRoleId=undefined;
  const adminPhone='0'+String(BigInt('0x'+tag)%1000000000n).padStart(9,'0');
  const customerUser=await req('/api/users','POST',{name:'Test managed customer',phone:adminPhone,password,role:'CUSTOMER'},admin,201);
  testUserId=customerUser.id; customerId=customerUser.customerId;
  if (!customerId) throw new Error('Tài khoản khách chưa được liên kết với customer');
  await db.query('DELETE FROM audit_event WHERE user_id=?',[testUserId]);
  await req(`/api/users/${testUserId}`,'DELETE',undefined,admin); testUserId=undefined;
  await db.query('DELETE FROM customer WHERE id=?',[customerId]); customerId=undefined;
  const phone='0'+String(BigInt('0x'+tag)%1000000000n).padStart(9,'0');
  const registered=await req('/api/auth/register','POST',{name:'Test customer',phone,password},undefined,201); customerId=registered.user.customerId; testUserId=registered.user.id;
  await req('/api/auth/me','GET',undefined,registered.token);
  await req('/api/auth/change-password','POST',{currentPassword:'wrong',newPassword:'new-password-123'},registered.token,401);
  await req('/api/auth/change-password','POST',{currentPassword:password,newPassword:'new-password-123'},registered.token,201);
  await req('/api/auth/login','POST',{identifier:phone,password},undefined,401);
  await req('/api/auth/logout','POST',undefined,registered.token,201);
  await req('/api/auth/me','GET',undefined,registered.token,401);
  console.log('Kiểm thử xác thực, CRUD và RBAC thành công.');
} finally {
  if(testUserId) { await db.query('DELETE FROM audit_event WHERE user_id=?',[testUserId]); await db.query('DELETE FROM `user` WHERE id=?',[testUserId]); }
  if(customerId) await db.query('DELETE FROM customer WHERE id=?',[customerId]);
  if(testRoleId) await db.query('DELETE FROM role WHERE id=?',[testRoleId]);
  if(adminId) { await db.query('DELETE FROM audit_event WHERE user_id=?',[adminId]); await db.query('DELETE FROM `user` WHERE id=?',[adminId]); }
  await db.end();
}
