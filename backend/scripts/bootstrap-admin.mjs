import 'dotenv/config';
import mysql from 'mysql2/promise';
import { randomBytes, scryptSync } from 'node:crypto';
const { BOOTSTRAP_ADMIN_EMAIL: email, BOOTSTRAP_ADMIN_PASSWORD: password, BOOTSTRAP_ADMIN_NAME: name = 'Quản trị viên' } = process.env;
if (!email || !password || password.length < 8) throw new Error('Cần BOOTSTRAP_ADMIN_EMAIL và BOOTSTRAP_ADMIN_PASSWORD ít nhất 8 ký tự.');
const connection = process.env.DATABASE_URL ? await mysql.createConnection(process.env.DATABASE_URL) : await mysql.createConnection({host:process.env.DB_HOST || '127.0.0.1',port:Number(process.env.DB_PORT || 3306),user:process.env.DB_USERNAME || 'thongvan',password:process.env.DB_PASSWORD || 'thongvan',database:process.env.DB_DATABASE || 'thongvan'});
try {
  const [[lock]] = await connection.query("SELECT GET_LOCK('thongvan_bootstrap_admin',10) acquired");
  if (!lock.acquired) throw new Error('Không lấy được khóa khởi tạo.');
  const [[existing]] = await connection.query("SELECT COUNT(*) count FROM `user` u JOIN role r ON r.id=u.role_id WHERE r.code='ADMIN'");
  if (existing.count) throw new Error('Đã có tài khoản ADMIN; không tạo thêm bằng lệnh khởi tạo.');
  const salt = randomBytes(16).toString('hex');
  const hash = `scrypt$${salt}$${scryptSync(password,salt,64).toString('hex')}`;
  const [result] = await connection.query("INSERT INTO `user` (name,email,password_hash,role_id) SELECT ?,?,?,id FROM role WHERE code='ADMIN'",[name,email.toLowerCase(),hash]);
  if (result.affectedRows !== 1) throw new Error('Không tìm thấy vai trò ADMIN; cần áp dụng migration 007.');
  console.log('Đã tạo tài khoản quản trị viên.');
} finally { await connection.end(); }
