import { createHash } from 'node:crypto';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CloudinaryService {
  constructor(private readonly config: ConfigService) {}

  createProductUploadSignature() {
    const cloudName = this.config.get<string>('cloudinary.cloudName');
    const apiKey = this.config.get<string>('cloudinary.apiKey');
    const apiSecret = this.config.get<string>('cloudinary.apiSecret');
    const folder = this.config.get<string>('cloudinary.productsFolder');

    if (!cloudName || !apiKey || !apiSecret || !folder) {
      throw new ServiceUnavailableException('Chưa cấu hình Cloudinary.');
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const signedParams = { folder, timestamp };
    const signatureBase = Object.entries(signedParams)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
    const signature = createHash('sha1')
      .update(`${signatureBase}${apiSecret}`)
      .digest('hex');

    return {
      cloudName,
      apiKey,
      folder,
      timestamp,
      signature,
      uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    };
  }
}
