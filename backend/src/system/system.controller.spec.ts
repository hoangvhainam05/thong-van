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

describe('SystemController Geoapify map tiles', () => {
  const controller = new SystemController({} as any);
  const originalFetch = global.fetch;
  const originalKey = process.env.GEOAPIFY_API_KEY;

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GEOAPIFY_API_KEY;
    else process.env.GEOAPIFY_API_KEY = originalKey;
  });

  test('proxies the new Geoapify map without exposing the server key', async () => {
    process.env.GEOAPIFY_API_KEY = 'server key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'image/png' },
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    });
    const response = { set: jest.fn() } as any;

    await controller.mapTile('13', '6400', '3790', response);

    expect(global.fetch).toHaveBeenCalledWith(
      'https://maps.geoapify.com/v1/tile/osm-bright/13/6400/3790.png?apiKey=server%20key',
      expect.any(Object),
    );
    expect(response.set).toHaveBeenCalledWith(expect.objectContaining({ 'Content-Type': 'image/png' }));
  });

  test('rejects invalid tile coordinates before contacting Geoapify', async () => {
    process.env.GEOAPIFY_API_KEY = 'server-key';
    global.fetch = jest.fn();

    await expect(controller.mapTile('3', '8', '0', { set: jest.fn() } as any)).rejects.toThrow(BadRequestException);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
