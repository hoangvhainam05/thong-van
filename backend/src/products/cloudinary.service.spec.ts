import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { CloudinaryService } from './cloudinary.service';

describe('CloudinaryService', () => {
  it('returns a signed, server-generated product upload request', () => {
    const values: Record<string, string> = {
      'cloudinary.cloudName': 'demo-cloud',
      'cloudinary.apiKey': 'demo-key',
      'cloudinary.apiSecret': 'private-secret',
      'cloudinary.productsFolder': 'thong-van/products',
    };
    const config = { get: (key: string) => values[key] } as unknown as ConfigService;
    const service = new CloudinaryService(config);

    const result = service.createProductUploadSignature();
    const base = `folder=${result.folder}&timestamp=${result.timestamp}private-secret`;

    expect(result.cloudName).toBe('demo-cloud');
    expect(result.apiKey).toBe('demo-key');
    expect(result.uploadUrl).toBe('https://api.cloudinary.com/v1_1/demo-cloud/image/upload');
    expect(result.signature).toBe(createHash('sha1').update(base).digest('hex'));
    expect(result).not.toHaveProperty('apiSecret');
  });

  it('fails clearly when Cloudinary credentials are missing', () => {
    const config = { get: () => '' } as unknown as ConfigService;
    const service = new CloudinaryService(config);
    expect(() => service.createProductUploadSignature()).toThrow(ServiceUnavailableException);
  });
});
