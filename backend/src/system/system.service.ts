import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Driver, Vehicle } from '../database/entities';

@Injectable()
export class SystemService {
  constructor(
    @InjectRepository(Driver) private readonly driverRepo: Repository<Driver>,
    @InjectRepository(Vehicle) private readonly vehicleRepo: Repository<Vehicle>,
  ) {}

  async drivers() {
    const drivers = await this.driverRepo.find({ where: { active: true } });
    return drivers.map((driver) => ({ id: driver.id, name: driver.name }));
  }

  async vehicles() {
    const vehicles = await this.vehicleRepo.find({ where: { active: true } });
    return vehicles.map((vehicle) => ({
      id: vehicle.id,
      plate: vehicle.plate,
      capacity_m3: Number(vehicle.capacityM3),
    }));
  }
}
