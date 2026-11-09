import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

type ImageFile = { buffer: Buffer; size: number; mimetype: string };
@Injectable()
export class PaymentSupportService {
  constructor(private readonly db: DataSource) {}
  async create(orderId: number, customerId: number | null, message: unknown, file?: ImageFile) {
    if (!customerId) throw new NotFoundException('Không tìm thấy đơn hàng.');
    const [order] = await this.db.query('SELECT id FROM orders WHERE id=? AND customer_id=?', [orderId, customerId]);
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng.');
    if (typeof message !== 'string' || message.trim().length < 5 || message.trim().length > 1000) throw new BadRequestException('Vui lòng nhập lý do từ 5 đến 1000 ký tự.');
    if (file) {
      const b = file.buffer;
      const valid = (file.mimetype === 'image/jpeg' && b.subarray(0,3).equals(Buffer.from([0xff,0xd8,0xff]))) || (file.mimetype === 'image/png' && b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) || (file.mimetype === 'image/webp' && b.toString('ascii',0,4) === 'RIFF' && b.toString('ascii',8,12) === 'WEBP');
      if (!file.size || file.size > 3 * 1024 * 1024 || !valid) throw new BadRequestException('Ảnh phải là JPEG, PNG hoặc WebP và không quá 3 MB.');
    }
    await this.db.query('INSERT INTO payment_support_request (order_id,customer_id,message,image_data,image_mime) VALUES (?,?,?,?,?)', [orderId,customerId,message.trim(),file?.buffer || null,file?.mimetype || null]);
    return { success: true };
  }
  async list() {
    return this.db.query('SELECT r.id,r.order_id,o.code,r.message,r.created_at,(r.image_data IS NOT NULL) has_image FROM payment_support_request r JOIN orders o ON o.id=r.order_id ORDER BY r.id DESC LIMIT 100');
  }
  async image(id: number) {
    const [row] = await this.db.query('SELECT image_data,image_mime FROM payment_support_request WHERE id=?', [id]);
    if (!row?.image_data) throw new NotFoundException('Không tìm thấy ảnh.');
    return row;
  }
}
