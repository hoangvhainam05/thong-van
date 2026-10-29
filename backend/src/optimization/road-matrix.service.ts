import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { buildMatrices, LatLng, Matrices } from './distance';

export type MatrixSource = 'ors' | 'estimate';
export interface RoadMatrix extends Matrices { source: MatrixSource }

@Injectable()
export class RoadMatrixService {
  private readonly cache = new Map<string, { expires: number; matrix: RoadMatrix }>();

  constructor(private readonly config: ConfigService) {}

  async getMatrix(points: LatLng[]): Promise<RoadMatrix> {
    const key = this.config.get<string>('optimization.orsApiKey', '').trim();
    const fallback = (): RoadMatrix => ({
      ...buildMatrices(points, this.config.get<number>('optimization.roadFactor', 1.35),
        this.config.get<number>('optimization.avgSpeedKmh', 30)), source: 'estimate',
    });
    if (!key || points.length < 2) return fallback();
    const cacheKey = JSON.stringify(['driving-car', points]);
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) return cached.matrix;
    try {
      const matrix = await this.fetchMatrix(points, key);
      if (this.cache.size >= 20) this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(cacheKey, { expires: Date.now() + 5 * 60_000, matrix });
      return matrix;
    } catch {
      return fallback();
    }
  }

  async getGeometry(points: LatLng[]): Promise<LatLng[]> {
    const key = this.config.get<string>('optimization.orsApiKey', '').trim();
    if (!key) throw new ServiceUnavailableException('Chưa cấu hình OpenRouteService để vẽ đường đi');
    const geometry: LatLng[] = [];
    try {
      // ORS directions allows at most 50 waypoints per request; overlap chunks by one point.
      for (let start = 0; start < points.length - 1; start += 49) {
        const coordinates = points.slice(start, start + 50).map(([lat, lng]) => [lng, lat]);
        const response = await fetch('https://api.heigit.org/openrouteservice/v2/directions/driving-car/geojson', {
          method: 'POST', headers: { Authorization: key, 'Content-Type': 'application/json' },
          body: JSON.stringify({ coordinates }), signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) throw new Error('Directions request failed');
        const data = await response.json() as { features?: Array<{ geometry?: { type?: string; coordinates?: unknown } }> };
        const shape = data.features?.[0]?.geometry;
        if (shape?.type !== 'LineString' || !Array.isArray(shape.coordinates) || shape.coordinates.length < 2 ||
          !shape.coordinates.every((p: unknown) => Array.isArray(p) && p.length >= 2 && p.slice(0, 2).every((v: unknown) => typeof v === 'number' && Number.isFinite(v)))) throw new Error('Invalid geometry');
        const segment = (shape.coordinates as number[][]).map(([lng, lat]): LatLng => [lat, lng]);
        geometry.push(...(start ? segment.slice(1) : segment));
      }
      return geometry;
    } catch {
      throw new ServiceUnavailableException('Không tải được đường đi ô tô từ OpenRouteService. Vui lòng thử lại.');
    }
  }

  private async fetchMatrix(points: LatLng[], key: string): Promise<RoadMatrix> {
    const n = points.length;
    const km = Array.from({ length: n }, () => Array<number>(n).fill(0));
    const minutes = Array.from({ length: n }, () => Array<number>(n).fill(0));
    // 59 × 59 = 3481 pairs, including diagonal pairs.
    for (let i = 0; i < n; i += 59) {
      for (let j = 0; j < n; j += 59) {
        const sources = Array.from({ length: Math.min(59, n - i) }, (_, k) => i + k);
        const destinations = Array.from({ length: Math.min(59, n - j) }, (_, k) => j + k);
        const indices = [...new Set([...sources, ...destinations])];
        const localIndex = new Map(indices.map((index, local) => [index, local]));
        const body = {
          locations: indices.map((index) => [points[index][1], points[index][0]]),
          sources: sources.map((index) => String(localIndex.get(index))),
          destinations: destinations.map((index) => String(localIndex.get(index))),
          metrics: ['distance', 'duration'], units: 'm',
        };
        let response: Response | undefined;
        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            response = await fetch('https://api.heigit.org/openrouteservice/v2/matrix/driving-car', {
              method: 'POST', headers: { Authorization: key, 'Content-Type': 'application/json' },
              body: JSON.stringify(body), signal: AbortSignal.timeout(8000),
            });
            if (response.ok || response.status === 429 || response.status < 500) break;
          } catch {
            if (attempt === 1) throw new Error('Matrix request failed');
          }
        }
        if (!response?.ok) throw new Error('Matrix request failed');
        const data: unknown = await response.json();
        if (!data || typeof data !== 'object') throw new Error('Invalid matrix');
        const { distances, durations } = data as { distances?: unknown; durations?: unknown };
        const valid = (value: unknown): value is number[][] => Array.isArray(value)
          && value.length === sources.length && value.every((row: unknown) => Array.isArray(row)
            && row.length === destinations.length && row.every((cell: unknown) => typeof cell === 'number' && Number.isFinite(cell) && cell >= 0));
        if (!valid(distances) || !valid(durations)) throw new Error('Invalid matrix');
        sources.forEach((source, row) => destinations.forEach((destination, col) => {
          km[source][destination] = distances[row][col] / 1000;
          minutes[source][destination] = durations[row][col] / 60;
        }));
      }
    }
    return { km, minutes, source: 'ors' };
  }
}
