import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
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

describe('SystemController MapTiler satellite tiles', () => {
  const controller = new SystemController({} as any);
  const originalFetch = global.fetch;
  const originalKey = process.env.MAPTILER_API_KEY;

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.MAPTILER_API_KEY;
    else process.env.MAPTILER_API_KEY = originalKey;
  });

  test('proxies MapTiler satellite tiles without exposing the server key', async () => {
    process.env.MAPTILER_API_KEY = 'server key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'image/jpeg' },
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    });
    const response = { set: jest.fn() } as any;

    await controller.mapTile('13', '6400', '3790', response);

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.maptiler.com/tiles/satellite-v2/13/6400/3790.jpg?key=server%20key',
      expect.any(Object),
    );
    expect(response.set).toHaveBeenCalledWith(expect.objectContaining({ 'Content-Type': 'image/jpeg' }));
  });

  test('rejects invalid tile coordinates before contacting MapTiler', async () => {
    process.env.MAPTILER_API_KEY = 'server-key';
    global.fetch = jest.fn();

    await expect(controller.mapTile('3', '8', '0', { set: jest.fn() } as any)).rejects.toThrow(BadRequestException);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
