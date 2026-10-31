import { ServiceUnavailableException } from '@nestjs/common';
import { SystemController } from './system.controller';

describe('SystemController approximate location', () => {
  const controller = new SystemController({} as any);

  test('reads Vercel IP geolocation headers', () => {
    expect(controller.approximateLocation({
      'x-vercel-ip-latitude': '16.0678',
      'x-vercel-ip-longitude': '108.2208',
      'x-vercel-ip-city': '%C4%90%C3%A0%20N%E1%BA%B5ng',
    })).toEqual({ lat: 16.0678, lng: 108.2208, city: 'Đà Nẵng', approximate: true });
  });

  test('rejects requests without valid coordinates', () => {
    expect(() => controller.approximateLocation({})).toThrow(ServiceUnavailableException);
  });
});
