import { BadRequestException, Body, Controller, Get, Header, Headers, Param, ParseIntPipe, Patch, Post, Query, ServiceUnavailableException, UseGuards } from '@nestjs/common';
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
