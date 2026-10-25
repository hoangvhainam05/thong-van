export type LatLng = [number, number];

export function haversineKm(a: LatLng, b: LatLng): number {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const [lat1, lng1] = a.map(toRadians);
  const [lat2, lng2] = b.map(toRadians);
  const dLat = lat2 - lat1;
  const dLng = lng2 - lng1;
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export function buildMatrices(
  points: LatLng[],
  roadFactor = 1.35,
  averageSpeedKmh = 30,
): { km: number[][]; minutes: number[][] } {
  const km = points.map(() => points.map(() => 0));
  const minutes = points.map(() => points.map(() => 0));
  for (let i = 0; i < points.length; i += 1) {
    for (let j = 0; j < points.length; j += 1) {
      if (i === j) continue;
      const distance = haversineKm(points[i], points[j]) * roadFactor;
      km[i][j] = distance;
      minutes[i][j] = Math.max(1, Math.round((distance / averageSpeedKmh) * 60));
    }
  }
  return { km, minutes };
}
