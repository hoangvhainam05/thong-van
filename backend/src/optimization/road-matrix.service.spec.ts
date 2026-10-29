import { ConfigService } from '@nestjs/config';
import { RoadMatrixService } from './road-matrix.service';
import { LatLng } from './distance';

describe('RoadMatrixService', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });
  const service = (key = 'test-key') => new RoadMatrixService({
    get: (name: string, fallback: unknown) => name === 'optimization.orsApiKey' ? key : fallback,
  } as ConfigService);

  it('requests road geometry in visit order and converts GeoJSON coordinates', async () => {
    const mock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ features: [{ geometry: { type: 'LineString', coordinates: [[105, 21], [105.5, 21.5], [106, 22]] } }] }) });
    global.fetch = mock;
    expect(await service().getGeometry([[21, 105], [22, 106]])).toEqual([[21, 105], [21.5, 105.5], [22, 106]]);
    expect(JSON.parse(mock.mock.calls[0][1].body).coordinates).toEqual([[105, 21], [106, 22]]);
  });

  it('reports an unavailable road instead of drawing an invented line', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false });
    await expect(service().getGeometry([[21, 105], [22, 106]])).rejects.toThrow('Không tải được đường đi');
  });

  it('requests longitude/latitude, converts units and caches the result', async () => {
    const mock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ distances: [[0, 1500], [2300, 0]], durations: [[0, 90], [180, 0]] }) });
    global.fetch = mock;
    const client = service();
    const points: LatLng[] = [[21, 105], [22, 106]];
    const matrix = await client.getMatrix(points);
    expect(matrix).toEqual({ source: 'ors', km: [[0, 1.5], [2.3, 0]], minutes: [[0, 1.5], [3, 0]] });
    expect(JSON.parse(mock.mock.calls[0][1].body).locations).toEqual([[105, 21], [106, 22]]);
    expect(mock.mock.calls[0][0]).toBe('https://api.heigit.org/openrouteservice/v2/matrix/driving-car');
    await client.getMatrix(points);
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it('splits larger matrices into requests within 3500 pairs', async () => {
    const mock = jest.fn().mockImplementation(async (_url, init) => {
      const body = JSON.parse(init.body);
      expect(body.sources.length * body.destinations.length).toBeLessThanOrEqual(3500);
      const rows = body.sources.map(() => body.destinations.map(() => 60));
      return { ok: true, json: async () => ({ distances: rows, durations: rows }) };
    });
    global.fetch = mock;
    const result = await service().getMatrix(Array.from({ length: 60 }, (_, i): LatLng => [21 + i / 1000, 105]));
    expect(mock).toHaveBeenCalledTimes(4);
    expect(result.source).toBe('ors');
    expect(result.km[59][0]).toBe(0.06);
  });

  it('uses a complete estimate for malformed responses and rate limits', async () => {
    const points: LatLng[] = [[21, 105], [22, 106]];
    for (const response of [
      { ok: true, json: async () => ({ distances: [[0, null], [1, 0]], durations: [[0, 1], [1, 0]] }) },
      { ok: false, status: 429 },
    ]) {
      const mock = jest.fn().mockResolvedValue(response);
      global.fetch = mock;
      const result = await service().getMatrix(points);
      expect(result.source).toBe('estimate');
      expect(result.km[0][1]).toBeGreaterThan(1);
      expect(mock).toHaveBeenCalledTimes(1);
    }
    const mock = jest.fn();
    global.fetch = mock;
    expect((await service('').getMatrix(points)).source).toBe('estimate');
    expect(mock).not.toHaveBeenCalled();
  });
  it('discards successful blocks if a later block fails', async () => {
    const mock = jest.fn().mockImplementation(async (_url, init) => {
      if (mock.mock.calls.length === 2) return { ok: false, status: 429 };
      const body = JSON.parse(init.body);
      const rows = body.sources.map(() => body.destinations.map(() => 1000));
      return { ok: true, json: async () => ({ distances: rows, durations: rows }) };
    });
    global.fetch = mock;
    const result = await service().getMatrix(Array.from({ length: 60 }, (_, i): LatLng => [21 + i / 1000, 105]));
    expect(result.source).toBe('estimate');
    expect(result.km[0][0]).toBe(0);
    expect(mock).toHaveBeenCalledTimes(2);
  });

});
