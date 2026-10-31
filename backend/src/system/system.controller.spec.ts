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

  test('falls back to satellite imagery when MapTiler fails', async () => {
    process.env.MAPTILER_API_KEY = 'restricted-key';
    (controller as any).maptilerRestrictedUntil = 0;
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: false, status: 403 })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'image/jpeg' },
        arrayBuffer: async () => new Uint8Array([4, 5, 6]).buffer,
      });
    const response = { set: jest.fn() } as any;

    await controller.mapTile('13', '6400', '3790', response);

    expect(global.fetch).toHaveBeenNthCalledWith(1,
      'https://api.maptiler.com/tiles/satellite-v2/13/6400/3790.jpg?key=restricted-key',
      expect.any(Object),
    );
    expect(global.fetch).toHaveBeenNthCalledWith(2,
      'https://mt1.google.com/vt/lyrs=y&x=6400&y=3790&z=13',
      expect.any(Object),
    );
    expect(response.set).toHaveBeenCalledWith(expect.objectContaining({ 'Content-Type': 'image/jpeg' }));
  });

  test('supports zoom levels up to 22', async () => {
    delete process.env.MAPTILER_API_KEY;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'image/jpeg' },
      arrayBuffer: async () => new Uint8Array([1]).buffer,
    });
    const response = { set: jest.fn() } as any;

    await controller.mapTile('22', '1000', '2000', response);
    expect(global.fetch).toHaveBeenCalledWith('https://mt1.google.com/vt/lyrs=y&x=1000&y=2000&z=22', expect.any(Object));
  });

  test('proxies street map tiles when type=street', async () => {
    process.env.GEOAPIFY_API_KEY = 'geo-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'image/png' },
      arrayBuffer: async () => new Uint8Array([7, 8, 9]).buffer,
    });
    const response = { set: jest.fn() } as any;

    await controller.mapTile('13', '6400', '3790', response, 'street');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://maps.geoapify.com/v1/tile/osm-bright/13/6400/3790.png?apiKey=geo-key',
      expect.any(Object),
    );
    expect(response.set).toHaveBeenCalledWith(expect.objectContaining({ 'Content-Type': 'image/png' }));
  });

  test('rejects invalid tile coordinates before contacting tile providers', async () => {
    process.env.MAPTILER_API_KEY = 'server-key';
    global.fetch = jest.fn();

    await expect(controller.mapTile('3', '8', '0', { set: jest.fn() } as any)).rejects.toThrow(BadRequestException);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
