import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';

type ImageFile = { buffer: Buffer; size: number; mimetype: string };
@Injectable()
export class DeliveryProofService {
  constructor(private readonly db: DataSource, private readonly config: ConfigService) {}

  async downloadUrl(stopId: number, driverId: number | null) {
    if (!driverId) throw new ForbiddenException('Tài khoản chưa được liên kết với tài xế');
    const [stop] = await this.db.query('SELECT s.proof_public_id,s.proof_format,r.driver_id FROM delivery_stop s JOIN route r ON r.id=s.route_id WHERE s.id=?', [stopId]);
    if (!stop) throw new NotFoundException('Không tìm thấy điểm dừng');
    if (stop.driver_id !== driverId) throw new ForbiddenException('Tuyến không được phân công cho tài khoản này');
    if (!stop.proof_public_id || !stop.proof_format) throw new NotFoundException('Điểm giao chưa có ảnh');
    return this.signedDownload(stop.proof_public_id, stop.proof_format);
  }

  // Call only after checking the requesting customer owns the delivered order.
  async customerDownloadUrl(stopId: number) {
    const [stop] = await this.db.query("SELECT proof_public_id,proof_format FROM delivery_stop WHERE id=? AND result='DELIVERED'", [stopId]);
    if (!stop?.proof_public_id || !stop.proof_format) throw new NotFoundException('Điểm giao chưa có ảnh');
    return this.signedDownload(stop.proof_public_id, stop.proof_format);
  }

  private signedDownload(publicId: string, format: string) {
    const cloud = this.config.get<string>('cloudinary.cloudName', '');
    const key = this.config.get<string>('cloudinary.apiKey', '');
    const secret = this.config.get<string>('cloudinary.apiSecret', '');
    if (!cloud || !key || !secret) throw new ServiceUnavailableException('Chưa cấu hình Cloudinary');
    const now = Math.floor(Date.now()/1000);
    const params = { expires_at: String(now+300), format, public_id: publicId, timestamp: String(now), type: 'authenticated' };
    const signature = createHash('sha1').update(Object.entries(params).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('&') + secret).digest('hex');
    return { url: `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/image/download?${new URLSearchParams({ ...params, api_key:key, signature })}`, expires_in: 300 };
  }

  async upload(stopId: number, driverId: number | null, userId: number, file?: ImageFile) {
    if (!driverId) throw new ForbiddenException('Tài khoản chưa được liên kết với tài xế');
    if (!file || !file.size || file.size > 5 * 1024 * 1024) throw new BadRequestException('Ảnh phải nhỏ hơn hoặc bằng 5 MB');
    const b = file.buffer;
    const jpeg = b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
    const png = b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const webp = b.length >= 12 && b.toString('ascii',0,4) === 'RIFF' && b.toString('ascii',8,12) === 'WEBP';
    if (!((jpeg && file.mimetype === 'image/jpeg') || (png && file.mimetype === 'image/png') || (webp && file.mimetype === 'image/webp'))) throw new BadRequestException('Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP');
    const [stop] = await this.db.query('SELECT s.completed_at,s.proof_uploaded_at,r.driver_id,r.status FROM delivery_stop s JOIN route r ON r.id=s.route_id WHERE s.id=?', [stopId]);
    if (!stop) throw new NotFoundException('Không tìm thấy điểm dừng');
    if (stop.driver_id !== driverId) throw new ForbiddenException('Tuyến không được phân công cho tài khoản này');
    if (stop.status !== 'IN_PROGRESS' || stop.completed_at || stop.proof_uploaded_at) throw new ConflictException('Không thể tải ảnh cho điểm này');
    const cloud = this.config.get<string>('cloudinary.cloudName', '');
    const key = this.config.get<string>('cloudinary.apiKey', '');
    const secret = this.config.get<string>('cloudinary.apiSecret', '');
    if (!cloud || !key || !secret) throw new ServiceUnavailableException('Chưa cấu hình Cloudinary cho ảnh giao hàng');
    const publicId = `thong-van/delivery/${stopId}/${randomUUID()}`;
    const timestamp = Math.floor(Date.now()/1000);
    const params = { public_id: publicId, timestamp: String(timestamp), type: 'authenticated' };
    const sign = (values: Record<string,string>) => createHash('sha1').update(Object.entries(values).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('&') + secret).digest('hex');
    const form = new FormData();
    for (const [k,v] of Object.entries(params)) form.append(k,v);
    form.append('api_key',key); form.append('signature',sign(params));
    form.append('file',new Blob([new Uint8Array(b)], {type:file.mimetype}), 'proof');
    let response: Response;
    try { response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/image/upload`, {method:'POST',body:form,signal:AbortSignal.timeout(30000)}); }
    catch { throw new ServiceUnavailableException('Không tải được ảnh lên Cloudinary'); }
    const data = await response.json().catch(() => null) as { public_id?:string; format?:string; type?:string } | null;
    if (!response.ok || data?.public_id !== publicId || data.type !== 'authenticated' || !['jpg','png','webp'].includes(data.format || '')) throw new ServiceUnavailableException('Cloudinary không xác nhận ảnh bảo mật');
    try {
      const result = await this.db.query("UPDATE delivery_stop s JOIN route r ON r.id=s.route_id JOIN `user` u ON u.id=? AND u.active=1 AND u.driver_id=r.driver_id SET s.proof_public_id=?,s.proof_format=?,s.proof_uploaded_by=?,s.proof_uploaded_at=NOW() WHERE s.id=? AND r.driver_id=? AND r.status='IN_PROGRESS' AND s.completed_at IS NULL AND s.proof_uploaded_at IS NULL",[userId,publicId,data.format,userId,stopId,driverId]);
      if (!result.affectedRows) throw new ConflictException('Điểm giao đã thay đổi; tải ảnh lại');
    } catch (error) {
      const destroyParams = { public_id: publicId, timestamp: String(Math.floor(Date.now()/1000)), type:'authenticated' };
      const destroy = new URLSearchParams({ ...destroyParams, api_key:key, signature:sign(destroyParams) });
      await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/image/destroy`, {method:'POST',body:destroy,signal:AbortSignal.timeout(10000)}).catch(()=>{});
      throw error;
    }
    return { uploaded: true };
  }
}
