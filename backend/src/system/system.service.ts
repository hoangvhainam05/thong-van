import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { DeliveryRoute, Driver, Vehicle, Warehouse } from '../database/entities';
import { CreateDriverDto, CreateVehicleDto, UpdateDriverDto, UpdateVehicleDto, UpdateWarehouseDto } from './fleet.dto';

@Injectable()
export class SystemService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Driver) private readonly driverRepo: Repository<Driver>,
    @InjectRepository(Vehicle) private readonly vehicleRepo: Repository<Vehicle>,
    @InjectRepository(Warehouse) private readonly warehouseRepo: Repository<Warehouse>,
  ) {}

  async drivers() {
    const drivers = await this.driverRepo.find({ relations: ['vehicles'], order: { id: 'ASC' } });
    return drivers.map((driver) => this.driverOut(driver));
  }

  async vehicles() {
    const vehicles = await this.vehicleRepo.find({ relations: ['drivers'], order: { id: 'ASC' } });
    return vehicles.map((vehicle) => this.vehicleOut(vehicle));
  }

  async warehouse() {
    const [row] = await this.warehouseRepo.find({ order: { id: 'ASC' }, take: 1 });
    if (!row) throw new NotFoundException('Chưa khai báo kho');
    return { id: row.id, name: row.name, address: row.address, lat: Number(row.lat), lng: Number(row.lng) };
  }

  async updateWarehouse(body: UpdateWarehouseDto) {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Warehouse);
      const warehouse = await repo.createQueryBuilder('warehouse').orderBy('warehouse.id', 'ASC').setLock('pessimistic_write').getOne();
      if (!warehouse) throw new NotFoundException('Chưa khai báo kho trong hệ thống');
      const coordinatesChanged = Number(warehouse.lat) !== body.lat || Number(warehouse.lng) !== body.lng;
      if (coordinatesChanged) {
        // Các tuyến đã lập giữ kho cũ, kể cả tuyến cũ chưa có ma trận định tuyến.
        const routes = manager.getRepository(DeliveryRoute);
        if (await routes.count({ where: { warehouseId: warehouse.id } })) {
          const previous = await repo.save(repo.create({ name: warehouse.name, address: warehouse.address, lat: warehouse.lat, lng: warehouse.lng }));
          await routes.update({ warehouseId: warehouse.id }, { warehouseId: previous.id });
        }
      }
      warehouse.name = body.name.trim(); warehouse.address = body.address.trim();
      warehouse.lat = String(body.lat); warehouse.lng = String(body.lng);
      const saved = await repo.save(warehouse);
      return { id: saved.id, name: saved.name, address: saved.address, lat: Number(saved.lat), lng: Number(saved.lng) };
    });
  }

  async createDriver(body: CreateDriverDto) {
    const saved = await this.driverRepo.save(this.driverRepo.create({ name: body.name.trim(), phone: body.phone, active: body.active ?? true }));
    return this.driverOut(saved);
  }

  async updateDriver(id: number, body: UpdateDriverDto) {
    const driver = await this.driverRepo.findOne({ where: { id }, relations: ['vehicles'] });
    if (!driver) throw new NotFoundException('Không tìm thấy tài xế');
    if (body.name !== undefined) driver.name = body.name.trim();
    if (body.phone !== undefined) driver.phone = body.phone;
    if (body.active !== undefined) driver.active = body.active;
    return this.driverOut(await this.driverRepo.save(driver));
  }

  async createVehicle(body: CreateVehicleDto) {
    if (await this.vehicleRepo.exist({ where: { plate: body.plate.trim() } })) throw new ConflictException('Biển số đã tồn tại');
    if (body.driver_ids && body.driver_ids.length > 2) {
      throw new BadRequestException('Mỗi xe chỉ được gắn tối đa 2 tài xế');
    }
    const distinctDriverIds = body.driver_ids ? [...new Set(body.driver_ids)] : [];
    if (distinctDriverIds.length !== (body.driver_ids?.length || 0)) {
      throw new BadRequestException('Không thể chọn trùng tài xế');
    }
    return this.dataSource.transaction(async (manager) => {
      const vRepo = manager.getRepository(Vehicle);
      const vehicle = await vRepo.save(vRepo.create({
        plate: body.plate.trim(),
        capacityM3: String(body.capacity_m3),
        capacityKg: String(body.capacity_kg),
        active: body.active ?? true,
      }));

      if (distinctDriverIds.length > 0) {
        await manager.query('DELETE FROM vehicle_driver WHERE driver_id IN (?)', [distinctDriverIds]);
        for (const driverId of distinctDriverIds) {
          await manager.query('INSERT INTO vehicle_driver (vehicle_id, driver_id) VALUES (?, ?)', [vehicle.id, driverId]);
        }
      }

      const reloaded = await vRepo.findOne({ where: { id: vehicle.id }, relations: ['drivers'] });
      return this.vehicleOut(reloaded!);
    });
  }

  async updateVehicle(id: number, body: UpdateVehicleDto) {
    const vehicle = await this.vehicleRepo.findOne({ where: { id }, relations: ['drivers'] });
    if (!vehicle) throw new NotFoundException('Không tìm thấy xe');
    if (body.driver_ids && body.driver_ids.length > 2) {
      throw new BadRequestException('Mỗi xe chỉ được gắn tối đa 2 tài xế');
    }
    const distinctDriverIds = body.driver_ids !== undefined ? [...new Set(body.driver_ids)] : undefined;
    if (distinctDriverIds && distinctDriverIds.length !== body.driver_ids!.length) {
      throw new BadRequestException('Không thể chọn trùng tài xế');
    }

    return this.dataSource.transaction(async (manager) => {
      const vRepo = manager.getRepository(Vehicle);
      if (body.plate !== undefined && body.plate.trim() !== vehicle.plate) {
        if (await vRepo.exist({ where: { plate: body.plate.trim() } })) throw new ConflictException('Biển số đã tồn tại');
        vehicle.plate = body.plate.trim();
      }
      if (body.capacity_m3 !== undefined) vehicle.capacityM3 = String(body.capacity_m3);
      if (body.capacity_kg !== undefined) vehicle.capacityKg = String(body.capacity_kg);
      if (body.active !== undefined) vehicle.active = body.active;
      await vRepo.save(vehicle);

      if (distinctDriverIds !== undefined) {
        await manager.query('DELETE FROM vehicle_driver WHERE vehicle_id = ?', [id]);
        if (distinctDriverIds.length > 0) {
          await manager.query('DELETE FROM vehicle_driver WHERE driver_id IN (?)', [distinctDriverIds]);
          for (const driverId of distinctDriverIds) {
            await manager.query('INSERT INTO vehicle_driver (vehicle_id, driver_id) VALUES (?, ?)', [id, driverId]);
          }
        }
      }

      const reloaded = await vRepo.findOne({ where: { id }, relations: ['drivers'] });
      return this.vehicleOut(reloaded!);
    });
  }

  private driverOut(driver: Driver) {
    const vehicle = driver.vehicles && driver.vehicles.length > 0 ? driver.vehicles[0] : null;
    return {
      id: driver.id,
      name: driver.name,
      phone: driver.phone,
      active: driver.active,
      vehicle_id: vehicle?.id ?? null,
      vehicle_plate: vehicle?.plate ?? null,
    };
  }

  private vehicleOut(vehicle: Vehicle) {
    return {
      id: vehicle.id,
      plate: vehicle.plate,
      capacity_m3: Number(vehicle.capacityM3),
      capacity_kg: Number(vehicle.capacityKg),
      active: vehicle.active,
      driver_ids: (vehicle.drivers || []).map((d) => d.id),
      drivers: (vehicle.drivers || []).map((d) => ({ id: d.id, name: d.name, phone: d.phone, active: d.active })),
    };
  }
}
