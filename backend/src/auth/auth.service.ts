import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { createHash, randomBytes, randomInt, scrypt as scryptCallback, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { createTransport } from 'nodemailer';
import { EntityManager } from 'typeorm';

const scrypt = promisify(scryptCallback);
const digest = (token: string) => createHash('sha256').update(token).digest('hex');
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64) as Buffer;
  return `scrypt$${salt}$${hash.toString('hex')}`;
}
async function verify(password: string, stored: string) {
  const [algorithm, salt, hex] = stored.split('$');
  if (algorithm !== 'scrypt' || !/^[a-f0-9]{32}$/.test(salt || '') || !/^[a-f0-9]{128}$/.test(hex || '')) return false;
  const actual = await scrypt(password, salt, 64) as Buffer;
  return timingSafeEqual(actual, Buffer.from(hex, 'hex'));
}
export interface Principal { id: number; name: string; email: string | null; phone: string | null; role: string; customerId: number | null; driverId: number | null; permissions: string[] }
@Injectable()
export class AuthService {
  private cleanupTimer: ReturnType<typeof setInterval>;
  constructor(@InjectDataSource() private readonly db: DataSource) {
    this.cleanupTimer = setInterval(() => { void this.db.query('DELETE FROM auth_otp WHERE expires_at<=NOW()').catch(() => {}); }, 30_000);
    this.cleanupTimer.unref();
  }
  onModuleDestroy() { clearInterval(this.cleanupTimer); }
  async requestOtp(rawEmail: string, purpose: string) {
    const email = rawEmail.trim().toLowerCase();
    const [user] = await this.db.query('SELECT id,active FROM `user` WHERE email=?', [email]);
    if (purpose === 'register' && user) throw new ConflictException('Email đã được sử dụng');
    // Trả lời giống nhau khi tài khoản không tồn tại để tránh lộ danh sách tài khoản.
    if (purpose === 'reset' && (!user || !user.active)) return { message: 'Nếu email hợp lệ, mã xác nhận đã được gửi.' };
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) throw new BadRequestException('Chưa cấu hình gửi email. Vui lòng liên hệ cửa hàng.');
    const newCode = String(randomInt(0, 1000000)).padStart(6, '0');
    const code = await this.db.transaction(async manager => {
      await manager.query('DELETE FROM auth_otp WHERE expires_at<=NOW()');
      await manager.query('INSERT INTO auth_otp(email,purpose,code,expires_at) VALUES(?,?,?,DATE_ADD(NOW(), INTERVAL 3 MINUTE)) ON DUPLICATE KEY UPDATE email=VALUES(email)', [email,purpose,newCode]);
      const [row] = await manager.query('SELECT code FROM auth_otp WHERE email=? AND purpose=? FOR UPDATE', [email,purpose]);
      return row.code;
    });
    try {
      await createTransport({ service: 'gmail', auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } }).sendMail({ from: process.env.SMTP_USER, to: email, subject: 'Mã xác nhận Thông Vân', text: `Mã xác nhận của bạn là ${code}. Mã có hiệu lực trong 3 phút kể từ lần gửi đầu tiên. Không chia sẻ mã này với người khác.` });
    } catch { throw new BadRequestException('Không gửi được email. Vui lòng thử lại sau.'); }
    return { message: 'Nếu email hợp lệ, mã xác nhận đã được gửi.' };
  }
  private async consumeOtp(manager: EntityManager, email: string, purpose: string, otp: string) {
    const result = await manager.query('DELETE FROM auth_otp WHERE email=? AND purpose=? AND code=? AND expires_at>NOW() AND attempts<5', [email,purpose,otp]);
    if (!result.affectedRows) throw new BadRequestException('Mã xác nhận không đúng, đã hết hạn hoặc đã được sử dụng.');
  }
  private async checkOtp(email: string, purpose: string, otp: string) {
    const [row] = await this.db.query('SELECT code FROM auth_otp WHERE email=? AND purpose=? AND expires_at>NOW() AND attempts<5', [email,purpose]);
    if (!row || row.code !== otp) {
      await this.db.query('UPDATE auth_otp SET attempts=attempts+1 WHERE email=? AND purpose=? AND expires_at>NOW()', [email,purpose]);
      throw new BadRequestException('Mã xác nhận không đúng, đã hết hạn hoặc đã được sử dụng.');
    }
  }
  async resetPassword(rawEmail: string, otp: string, newPassword: string) {
    const email = rawEmail.trim().toLowerCase();
    await this.checkOtp(email, 'reset', otp);
    const passwordHash = await hashPassword(newPassword);
    await this.db.transaction(async manager => {
      await this.consumeOtp(manager, email, 'reset', otp);
      const [user] = await manager.query('SELECT id FROM `user` WHERE email=? AND active=1 FOR UPDATE', [email]);
      if (!user) throw new BadRequestException('Không thể đặt lại mật khẩu.');
      await manager.query('UPDATE `user` SET password_hash=? WHERE id=?', [passwordHash,user.id]);
      await manager.query('DELETE FROM user_session WHERE user_id=?', [user.id]);
    });
    return { message: 'Đã đặt lại mật khẩu.' };
  }
  async principal(id: number): Promise<Principal> {
    const [user] = await this.db.query('SELECT u.id,u.name,u.email,u.phone,u.customer_id customerId,u.driver_id driverId,r.code role FROM `user` u JOIN role r ON r.id=u.role_id WHERE u.id=? AND u.active=1', [id]);
    if (!user) throw new UnauthorizedException('Phiên đăng nhập không hợp lệ');
    const permissions = await this.db.query('SELECT p.code FROM permission p JOIN role_permission rp ON rp.permission_id=p.id JOIN `user` u ON u.role_id=rp.role_id WHERE u.id=?', [id]);
    return { ...user, permissions: permissions.map((p: {code:string}) => p.code) };
  }
  async authenticate(token: string): Promise<Principal> {
    if (!token || token.length > 256) throw new UnauthorizedException('Vui lòng đăng nhập');
    const [session] = await this.db.query('SELECT user_id FROM user_session WHERE token_hash=? AND expires_at>NOW()', [digest(token)]);
    if (!session) throw new UnauthorizedException('Phiên đăng nhập đã hết hạn');
    return this.principal(session.user_id);
  }
  async login(identifier: string, password: string) {
    const [user] = await this.db.query('SELECT id,password_hash,active FROM `user` WHERE email=? OR phone=? LIMIT 1', [identifier.trim(), identifier.trim()]);
    if (!user || !user.active || !(await verify(password, user.password_hash))) throw new UnauthorizedException('Email/số điện thoại hoặc mật khẩu chưa đúng');
    const token = randomBytes(32).toString('hex');
    await this.db.query('INSERT INTO user_session(token_hash,user_id,expires_at) VALUES(?,?,DATE_ADD(NOW(), INTERVAL 12 HOUR))', [digest(token), user.id]);
    return { token, user: await this.principal(user.id) };
  }
  async logout(token: string) { await this.db.query('DELETE FROM user_session WHERE token_hash=?', [digest(token)]); }
  async register(input: {name:string; phone:string; email:string; password:string; otp:string}) {
    input.email = input.email.trim().toLowerCase();
    await this.checkOtp(input.email, 'register', input.otp);
    const passwordHash = await hashPassword(input.password);
    try {
      await this.db.transaction(async manager => {
        await this.consumeOtp(manager, input.email, 'register', input.otp);
        const [role] = await manager.query("SELECT id FROM role WHERE code='CUSTOMER'");
        if (!role) throw new BadRequestException('Chưa cấu hình vai trò khách hàng');
        const [existing] = await manager.query('SELECT id FROM customer WHERE phone=?',[input.phone]);
        if (existing) throw new ConflictException('Số điện thoại đã tồn tại; liên hệ cửa hàng để liên kết tài khoản');
        const customer = await manager.query('INSERT INTO customer(name,phone,email) VALUES(?,?,?)',[input.name.trim(),input.phone,input.email?.trim().toLowerCase() || null]);
        await manager.query('INSERT INTO `user` (name,phone,email,password_hash,role_id,customer_id) VALUES(?,?,?,?,?,?)',[input.name.trim(),input.phone,input.email?.trim().toLowerCase() || null,passwordHash,role.id,customer.insertId]);
      });
    } catch (e) { if ((e as {code?:string}).code === 'ER_DUP_ENTRY') throw new ConflictException('Email hoặc số điện thoại đã được sử dụng'); throw e; }
    return this.login(input.phone,input.password);
  }
  async profile(id:number, input:{name:string;email?:string}) {
    if (!input.name.trim()) throw new BadRequestException('Cần họ tên');
    try { await this.db.transaction(async manager => {
      await manager.query('UPDATE `user` SET name=?,email=? WHERE id=?',[input.name.trim(),input.email?.trim().toLowerCase() || null,id]);
      await manager.query('UPDATE customer c JOIN `user` u ON u.customer_id=c.id SET c.name=?,c.email=? WHERE u.id=?',[input.name.trim(),input.email?.trim().toLowerCase() || null,id]);
    }); }
    catch(e) { if ((e as {code?:string}).code === 'ER_DUP_ENTRY') throw new ConflictException('Email đã được sử dụng'); throw e; }
    return this.principal(id);
  }
  async changePassword(id:number, token:string, currentPassword:string, newPassword:string) {
    const [user] = await this.db.query('SELECT password_hash FROM `user` WHERE id=?',[id]);
    if (!user || !(await verify(currentPassword,user.password_hash))) throw new UnauthorizedException('Mật khẩu hiện tại chưa đúng');
    const passwordHash = await hashPassword(newPassword);
    await this.db.transaction(async manager => {
      await manager.query('UPDATE `user` SET password_hash=? WHERE id=?',[passwordHash,id]);
      await manager.query('DELETE FROM user_session WHERE user_id=? AND token_hash<>?',[id,digest(token)]);
    });
  }
  async users() { return this.db.query('SELECT u.id,u.name,u.email,u.phone,u.active,r.code role,u.customer_id customerId,u.driver_id driverId,u.created_at createdAt FROM `user` u JOIN role r ON r.id=u.role_id ORDER BY u.id'); }
  async driverOptions() { return this.db.query('SELECT d.id,d.name,d.phone,d.active,u.id AS userId FROM driver d LEFT JOIN `user` u ON u.driver_id=d.id ORDER BY d.name,d.id'); }
  async user(id: number) { const users = await this.users(); const user = users.find((x: {id:number}) => x.id === id); if (!user) throw new NotFoundException('Không tìm thấy tài khoản'); return user; }
  async createUser(input: {name:string; email?:string; phone?:string; password:string; role:string; customerId?:number; driverId?:number}) {
    const [role] = await this.db.query('SELECT id FROM role WHERE code=?', [input.role]);
    if (!role) throw new BadRequestException('Vai trò không tồn tại');
    if (!input.email && !input.phone) throw new BadRequestException('Cần email hoặc số điện thoại');
    if (!input.name.trim()) throw new BadRequestException('Cần họ tên');
    const passwordHash = await hashPassword(input.password);
    try {
      const userId = await this.db.transaction(async manager => {
        let customerId = input.customerId || null;
        if (input.role === 'CUSTOMER' && !/^0\d{9,10}$/.test(input.phone || '')) throw new BadRequestException('Tài khoản khách hàng cần số điện thoại hợp lệ');
        if (input.role === 'CUSTOMER' && !customerId) {
          const [customer] = await manager.query('SELECT id FROM customer WHERE phone=?', [input.phone]);
          customerId = customer ? customer.id : (await manager.query('INSERT INTO customer(name,phone,email) VALUES(?,?,?)', [input.name.trim(), input.phone, input.email?.trim().toLowerCase() || null])).insertId;
        }
        const result = await manager.query('INSERT INTO `user` (name,email,phone,password_hash,role_id,customer_id,driver_id) VALUES (?,?,?,?,?,?,?)', [input.name.trim(),input.email?.trim().toLowerCase() || null,input.phone?.trim() || null,passwordHash,role.id,customerId,input.driverId || null]);
        return result.insertId;
      });
      return this.user(userId);
    } catch (e) {
      if ((e as {code?:string}).code === 'ER_DUP_ENTRY') throw new ConflictException('Email, số điện thoại hoặc liên kết đã được sử dụng');
      if ((e as {code?:string}).code === 'ER_NO_REFERENCED_ROW_2') throw new BadRequestException('Khách hàng hoặc tài xế không tồn tại');
      throw e;
    }
  }
  async updateUser(id: number, input: {name?:string; email?:string; phone?:string; password?:string; role?:string; active?:boolean; customerId?:number|null; driverId?:number|null}, actor: Principal) {
    const old = await this.user(id);
    if (id === actor.id && ((input.role && input.role !== old.role) || input.active === false)) throw new ForbiddenException('Không thể tự đổi vai trò hoặc tự khóa');
    const [role] = await this.db.query('SELECT id FROM role WHERE code=?', [input.role || old.role]);
    if (!role) throw new BadRequestException('Vai trò không tồn tại');
    const email = input.email === undefined ? old.email : input.email.trim().toLowerCase() || null;
    const phone = input.phone === undefined ? old.phone : input.phone.trim() || null;
    if (!email && !phone) throw new BadRequestException('Cần email hoặc số điện thoại');
    try {
      const passwordHash = input.password ? await hashPassword(input.password) : null;
      await this.db.transaction(async manager => {
        await manager.query("SELECT id FROM role WHERE code='ADMIN' FOR UPDATE");
        const [current] = await manager.query('SELECT u.active,r.code role FROM `user` u JOIN role r ON r.id=u.role_id WHERE u.id=? FOR UPDATE', [id]);
        if (!current) throw new NotFoundException('Không tìm thấy tài khoản');
        if (current.role === 'ADMIN' && current.active && (input.active === false || (input.role && input.role !== 'ADMIN'))) {
          const [count] = await manager.query("SELECT COUNT(*) count FROM `user` u JOIN role r ON r.id=u.role_id WHERE r.code='ADMIN' AND u.active=1");
          if (Number(count.count) <= 1) throw new ForbiddenException('Phải giữ lại ít nhất một quản trị viên đang hoạt động');
        }
        let customerId = input.customerId === undefined ? old.customerId : input.customerId;
        if ((input.role || old.role) === 'CUSTOMER' && !/^0\d{9,10}$/.test(phone || '')) throw new BadRequestException('Tài khoản khách hàng cần số điện thoại hợp lệ');
        if ((input.role || old.role) === 'CUSTOMER' && !customerId) {
          const [customer] = await manager.query('SELECT id FROM customer WHERE phone=?', [phone]);
          customerId = customer ? customer.id : (await manager.query('INSERT INTO customer(name,phone,email) VALUES(?,?,?)', [input.name?.trim() || old.name,phone,email])).insertId;
        }
        await manager.query('UPDATE `user` SET name=?,email=?,phone=?,role_id=?,active=?,customer_id=?,driver_id=? WHERE id=?', [input.name?.trim() || old.name,email,phone,role.id,input.active ?? old.active,customerId,input.driverId === undefined ? old.driverId : input.driverId,id]);
        if ((input.role || old.role) === 'CUSTOMER' && customerId) await manager.query('UPDATE customer SET name=?,phone=?,email=? WHERE id=?', [input.name?.trim() || old.name,phone,email,customerId]);
        if (passwordHash) { await manager.query('UPDATE `user` SET password_hash=? WHERE id=?', [passwordHash,id]); await manager.query('DELETE FROM user_session WHERE user_id=?', [id]); }
      });
      return this.user(id);
    } catch (e) {
      if ((e as {code?:string}).code === 'ER_DUP_ENTRY') throw new ConflictException('Email, số điện thoại hoặc liên kết đã được sử dụng');
      if ((e as {code?:string}).code === 'ER_NO_REFERENCED_ROW_2') throw new BadRequestException('Khách hàng hoặc tài xế không tồn tại');
      throw e;
    }
  }
  async deleteUser(id: number, actor: Principal) {
    if (id === actor.id) throw new ForbiddenException('Không thể tự xóa tài khoản');
    await this.db.transaction(async manager => {
      await manager.query("SELECT id FROM role WHERE code='ADMIN' FOR UPDATE");
      const [user] = await manager.query('SELECT u.active,r.code role FROM `user` u JOIN role r ON r.id=u.role_id WHERE u.id=? FOR UPDATE', [id]);
      if (!user) throw new NotFoundException('Không tìm thấy tài khoản');
      if (user.role === 'ADMIN' && user.active) {
        const [count] = await manager.query("SELECT COUNT(*) count FROM `user` u JOIN role r ON r.id=u.role_id WHERE r.code='ADMIN' AND u.active=1");
        if (Number(count.count) <= 1) throw new ForbiddenException('Phải giữ lại ít nhất một quản trị viên đang hoạt động');
      }
      await manager.query('DELETE FROM `user` WHERE id=?', [id]);
    });
  }
  async roles() { const roles = await this.db.query('SELECT id,code,name FROM role ORDER BY id'); const links = await this.db.query('SELECT rp.role_id,p.code FROM role_permission rp JOIN permission p ON p.id=rp.permission_id'); return roles.map((r:{id:number}) => ({...r, permissions: links.filter((x:{role_id:number})=>x.role_id===r.id).map((x:{code:string})=>x.code)})); }
  async role(id: number) { const role = (await this.roles()).find((r:{id:number})=>r.id===id); if (!role) throw new NotFoundException('Không tìm thấy vai trò'); return role; }
  async saveRole(id: number | null, input: {code?:string;name?:string;permissions?:string[]}) {
    const existing = id ? await this.role(id) : null;
    if (existing?.code === 'ADMIN' && input.permissions && !['backoffice.access','role.manage','user.manage'].every(p => input.permissions!.includes(p))) throw new BadRequestException('Không thể gỡ quyền quản trị bắt buộc');
    if (existing && input.code && input.code !== existing.code) throw new BadRequestException('Không thể đổi mã vai trò');
    if (!existing && (!input.code || !input.name)) throw new BadRequestException('Cần mã và tên vai trò');
    return this.db.transaction(async manager => {
      let roleId = id;
      if (!roleId) { const result = await manager.query('INSERT INTO role(code,name) VALUES(?,?)',[input.code,input.name]); roleId = result.insertId; }
      else if (input.name) await manager.query('UPDATE role SET name=? WHERE id=?',[input.name,roleId]);
      if (input.permissions) {
        const distinct = [...new Set(input.permissions)];
        const rows = distinct.length ? await manager.query('SELECT id,code FROM permission WHERE code IN (?)',[distinct]) : [];
        if (rows.length !== distinct.length) throw new BadRequestException('Quyền không tồn tại');
        await manager.query('DELETE FROM role_permission WHERE role_id=?',[roleId]);
        for (const p of rows) await manager.query('INSERT INTO role_permission(role_id,permission_id) VALUES(?,?)',[roleId,p.id]);
      }
      return roleId;
    }).then(roleId=>this.role(roleId!)).catch(e => {
      if ((e as {code?:string}).code === 'ER_DUP_ENTRY') throw new ConflictException('Mã vai trò đã tồn tại');
      throw e;
    });
  }
  async deleteRole(id: number) { const role=await this.role(id); if (['ADMIN','MANAGER','SALES','DRIVER','CUSTOMER'].includes(role.code)) throw new ForbiddenException('Không thể xóa vai trò hệ thống'); const [usage]=await this.db.query('SELECT COUNT(*) count FROM `user` WHERE role_id=?',[id]); if (Number(usage.count)) throw new ConflictException('Vai trò đang được sử dụng'); await this.db.query('DELETE FROM role WHERE id=?',[id]); }
  async permissions() { return this.db.query('SELECT code,name FROM permission ORDER BY id'); }
}
