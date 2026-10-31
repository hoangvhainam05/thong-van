import { BadRequestException, Body, Controller, Get, Header, Headers, Param, ParseIntPipe, Patch, Post, Query, Res, ServiceUnavailableException, StreamableFile, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard, RequirePermission } from '../auth/auth.guard';
import { CreateDriverDto, CreateVehicleDto, UpdateDriverDto, UpdateVehicleDto, UpdateWarehouseDto } from './fleet.dto';
import { SystemService } from './system.service';

@Controller('api')
export class SystemController {
  constructor(private readonly system: SystemService) {}

  @Get('health')
  health() {
    return { status: 'ok' };
  }

  @Get('location/geocode')
  @Header('Cache-Control', 'no-store')
  async geocode(@Query('q') q?: string, @Query('lat') lat?: string, @Query('lon') lon?: string, @Query('reverse') reverse?: string) {
    const key = process.env.GEOAPIFY_API_KEY?.trim();
    if (!key) throw new ServiceUnavailableException('Chưa cấu hình tìm kiếm địa chỉ');
    const latitude = Number(lat), longitude = Number(lon);
    if (!lat || !lon || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || (reverse !== '1' && (!q?.trim() || q.length > 255))) throw new BadRequestException('Thông tin vị trí không hợp lệ');
    const params = new URLSearchParams({ apiKey: key, format: 'json', lang: 'vi', limit: '5' });
    if (reverse === '1') { params.set('lat', lat); params.set('lon', lon); }
    else { params.set('text', q!.trim()); params.set('filter', 'countrycode:vn'); params.set('bias', `proximity:${longitude},${latitude}`); }
    try {
      const response = await fetch(`https://api.geoapify.com/v1/geocode/${reverse === '1' ? 'reverse' : 'search'}?${params}`, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error();
      const data = await response.json() as { results?: Array<Record<string, any>> };
      return (data.results || []).map(item => ({ place_id: item.place_id, lat: item.lat, lon: item.lon, display_name: item.formatted, address: { house_number: item.housenumber, district: item.district || item.county || '' } }));
    } catch { throw new ServiceUnavailableException('Không tìm được địa chỉ, vui lòng thử lại'); }
  }

  private maptilerRestrictedUntil = 0;

  @Get('location/tiles/:z/:x/:y')
  async mapTile(@Param('z') rawZ: string, @Param('x') rawX: string, @Param('y') rawY: string, @Res({ passthrough: true }) response: Response) {
    const key = process.env.MAPTILER_API_KEY?.trim();
    const z = Number(rawZ), x = Number(rawX), y = Number(rawY);
    const tileLimit = Number.isInteger(z) && z >= 0 && z <= 22 ? 2 ** z : 0;
    if (!tileLimit || !Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= tileLimit || y >= tileLimit) {
      throw new BadRequestException('Tọa độ tile không hợp lệ');
    }
    // 1. Thử MapTiler nếu có key và không trong thời gian cooldown
    if (key && Date.now() > this.maptilerRestrictedUntil) {
      try {
        const tile = await fetch(`https://api.maptiler.com/tiles/satellite-v2/${z}/${x}/${y}.jpg?key=${encodeURIComponent(key)}`, { signal: AbortSignal.timeout(4000) });
        if (tile.ok) {
          response.set({
            'Content-Type': tile.headers.get('content-type') || 'image/jpeg',
            'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
          });
          return new StreamableFile(new Uint8Array(await tile.arrayBuffer()));
        }
        if (tile.status === 401 || tile.status === 403) {
          this.maptilerRestrictedUntil = Date.now() + 60_000;
        }
      } catch {}
    }
    // 2. Dự phòng ảnh vệ tinh Google Hybrid (ảnh vệ tinh độ nét cao kèm tên đường tiếng Việt)
    try {
      const tile = await fetch(`https://mt1.google.com/vt/lyrs=y&x=${x}&y=${y}&z=${z}`, {
        signal: AbortSignal.timeout(8000),
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      if (tile.ok) {
        response.set({
          'Content-Type': tile.headers.get('content-type') || 'image/jpeg',
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        });
        return new StreamableFile(new Uint8Array(await tile.arrayBuffer()));
      }
    } catch {}
    // 3. Dự phòng tiếp theo: Esri World Imagery
    try {
      const tile = await fetch(`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (tile.ok) {
        response.set({
          'Content-Type': tile.headers.get('content-type') || 'image/jpeg',
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        });
        return new StreamableFile(new Uint8Array(await tile.arrayBuffer()));
      }
    } catch {}
    throw new ServiceUnavailableException('Không tải được bản đồ');
  }

  @Get('location/approximate')
  @Header('Cache-Control', 'no-store')
  approximateLocation(@Headers() headers: Record<string, string | string[] | undefined>) {
    const lat = Number(headers['x-vercel-ip-latitude']);
    const lng = Number(headers['x-vercel-ip-longitude']);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      throw new ServiceUnavailableException('Approximate location is unavailable');
    }
    const rawCity = String(headers['x-vercel-ip-city'] || '');
    let city = rawCity;
    try { city = decodeURIComponent(rawCity); } catch {}
    return { lat, lng, city, approximate: true };
  }

  @Get('drivers')
  @UseGuards(AuthGuard)
  @RequirePermission('dispatch.view')
  drivers() {
    return this.system.drivers();
  }

  @Get('vehicles')
  @UseGuards(AuthGuard)
  @RequirePermission('dispatch.view')
  vehicles() {
    return this.system.vehicles();
  }

  @Get('warehouse')
  @UseGuards(AuthGuard)
  @RequirePermission('dispatch.view')
  warehouse() { return this.system.warehouse(); }

  @Patch('warehouse')
  @UseGuards(AuthGuard)
  @RequirePermission('fleet.manage')
  updateWarehouse(@Body() body: UpdateWarehouseDto) { return this.system.updateWarehouse(body); }

  @Post('drivers')
  @UseGuards(AuthGuard)
  @RequirePermission('fleet.manage')
  createDriver(@Body() body: CreateDriverDto) { return this.system.createDriver(body); }

  @Patch('drivers/:id')
  @UseGuards(AuthGuard)
  @RequirePermission('fleet.manage')
  updateDriver(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateDriverDto) { return this.system.updateDriver(id, body); }

  @Post('vehicles')
  @UseGuards(AuthGuard)
  @RequirePermission('fleet.manage')
  createVehicle(@Body() body: CreateVehicleDto) { return this.system.createVehicle(body); }

  @Patch('vehicles/:id')
  @UseGuards(AuthGuard)
  @RequirePermission('fleet.manage')
  updateVehicle(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateVehicleDto) { return this.system.updateVehicle(id, body); }
}
