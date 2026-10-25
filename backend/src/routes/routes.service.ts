import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsRelations, Repository } from 'typeorm';
import {
  DeliveryRoute,
  DeliveryStop,
  Driver,
  Order,
  OrderItem,
  OrderStatus,
  Product,
  RouteStatus,
  Vehicle,
  Warehouse,
} from '../database/entities';
import { etaWindow } from '../optimization/eta';
import {
  baselineKm,
  Depot,
  optimize,
  StopSpec,
  VehicleSpec,
} from '../optimization/solver';
import { StopCompleteDto } from './route.dto';

const ROUTE_RELATIONS: FindOptionsRelations<DeliveryRoute> = {
  driver: true,
  vehicle: true,
  stops: { order: { customer: true } },
};

const ORDER_RELATIONS: FindOptionsRelations<Order> = {
  items: { product: true },
  stop: true,
};

const UNLOAD_MINUTES = 10;

@Injectable()
export class RoutesService {
  constructor(
    @InjectRepository(DeliveryRoute) private readonly routes: Repository<DeliveryRoute>,
    @InjectRepository(DeliveryStop) private readonly stops: Repository<DeliveryStop>,
    @InjectRepository(Driver) private readonly drivers: Repository<Driver>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(OrderItem) private readonly orderItems: Repository<OrderItem>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(Vehicle) private readonly vehicles: Repository<Vehicle>,
    @InjectRepository(Warehouse) private readonly warehouses: Repository<Warehouse>,
    private readonly config: ConfigService,
  ) {}

  async optimize(routeDate: string) {
    const warehouse = await this.warehouses.findOne({ order: { id: 'ASC' } });
    if (!warehouse) throw new ConflictException('Chưa khai báo kho');

    const draftRoutes = await this.routes.find({
      where: { routeDate, status: RouteStatus.DRAFT },
      relations: { stops: { order: true } },
    });
    for (const route of draftRoutes) {
      for (const stop of route.stops || []) {
        await this.orders.update(stop.orderId, { status: OrderStatus.READY });
      }
      await this.routes.delete(route.id);
    }

    const candidateOrders = await this.orders.find({
      where: { deliveryDate: routeDate, status: OrderStatus.READY },
      relations: ORDER_RELATIONS,
      order: { id: 'ASC' },
    });
    const missingLocation = candidateOrders.filter((order) => order.lat === null || order.lng === null);
    const orders = candidateOrders.filter((order) => order.lat !== null && order.lng !== null && !order.stop);
    const busyRoutes = await this.routes.find({ where: { routeDate } });
    const busyVehicles = new Set(busyRoutes.map((route) => route.vehicleId));
    const busyDrivers = new Set(busyRoutes.map((route) => route.driverId).filter((id): id is number => id !== null));
    const vehicles = (await this.vehicles.find({ where: { active: true }, order: { id: 'ASC' } }))
      .filter((vehicle) => !busyVehicles.has(vehicle.id));
    const drivers = (await this.drivers.find({ where: { active: true }, order: { id: 'ASC' } }))
      .filter((driver) => !busyDrivers.has(driver.id));
    if (!vehicles.length) throw new ConflictException('Không còn xe trống cho ngày này');

    const vehicleSpecs: VehicleSpec[] = vehicles.map((vehicle, index) => ({
      id: vehicle.id,
      capacityM3: Number(vehicle.capacityM3),
      driverId: drivers[index]?.id ?? null,
    }));
    const stops: StopSpec[] = orders.map((order) => ({
      orderId: order.id,
      lat: Number(order.lat),
      lng: Number(order.lng),
      twStart: timeToMinutes(order.timeWindowStart),
      twEnd: timeToMinutes(order.timeWindowEnd),
      serviceMin: UNLOAD_MINUTES + (order.items || []).reduce(
        (sum, item) => sum + item.product.installMinutes * item.quantity,
        0,
      ),
      volumeM3: (order.items || []).reduce(
        (sum, item) => sum + Number(item.product.volumeM3) * item.quantity,
        0,
      ),
    }));
    const depot: Depot = { lat: Number(warehouse.lat), lng: Number(warehouse.lng) };
    const result = optimize(depot, stops, vehicleSpecs, {
      dayStart: timeToMinutes(this.config.get<string>('optimization.dayStart', '08:00')),
      dayEnd: timeToMinutes(this.config.get<string>('optimization.dayEnd', '18:00')),
      weightKm: this.config.get<number>('optimization.weightKm', 1),
      weightTime: this.config.get<number>('optimization.weightTime', 0.5),
      roadFactor: this.config.get<number>('optimization.roadFactor', 1.35),
      speedKmh: this.config.get<number>('optimization.avgSpeedKmh', 30),
    });

    const orderById = new Map(orders.map((order) => [order.id, order]));
    const specById = new Map(stops.map((stop) => [stop.orderId, stop]));
    const created: DeliveryRoute[] = [];
    for (const plan of result.routes) {
      const ownStops = plan.stops
        .map((stop) => specById.get(stop.orderId)!)
        .sort((a, b) => a.orderId - b.orderId);
      const route = this.routes.create({
        routeDate,
        warehouseId: warehouse.id,
        driverId: plan.driverId,
        vehicleId: plan.vehicleId,
        status: RouteStatus.DRAFT,
        totalKm: String(plan.totalKm),
        totalMinutes: plan.totalMinutes,
        baselineKm: String(baselineKm(depot, ownStops, [{ id: plan.vehicleId, capacityM3: Number.MAX_SAFE_INTEGER }], this.config.get<number>('optimization.roadFactor', 1.35), this.config.get<number>('optimization.avgSpeedKmh', 30))),
        solver: result.solver,
        lockedAt: null,
        stops: [],
      });
      const savedRoute = await this.routes.save(route);
      const midnight = localMidnight(routeDate);
      const routeStops = plan.stops.map((plannedStop) => {
        const planned = new Date(midnight.getTime() + plannedStop.arrivalMin * 60_000);
        const [etaStart, etaEnd] = etaWindow(planned, plannedStop.sequence);
        const stop = this.stops.create({
          routeId: savedRoute.id,
          orderId: plannedStop.orderId,
          sequence: plannedStop.sequence,
          plannedArrival: planned,
          etaStart,
          etaEnd,
          actualArrival: null,
          completedAt: null,
        });
        const order = orderById.get(plannedStop.orderId);
        if (order) order.status = OrderStatus.SCHEDULED;
        return stop;
      });
      await this.stops.save(routeStops);
      await this.orders.save(orders.filter((order) => plan.stops.some((stop) => stop.orderId === order.id)));
      created.push(savedRoute);
    }

    const ids = created.map((route) => route.id);
    const routes = ids.length
      ? await this.routes.find({ where: ids.map((id) => ({ id })), relations: ROUTE_RELATIONS, order: { id: 'ASC' } })
      : [];
    return {
      routes: routes.map((route) => this.toOut(route)),
      unassigned_order_codes: result.unassigned.map((id) => orderById.get(id)?.code || '').filter(Boolean),
      missing_location_codes: missingLocation.map((order) => order.code || '').filter(Boolean),
      total_km: result.totalKm,
      baseline_km: result.baselineKm,
      saving_percent: result.savingPercent,
      solver: result.solver,
    };
  }

  async list(routeDate: string, driverId?: number) {
    const routes = await this.routes.find({
      where: {
        routeDate,
        ...(driverId === undefined ? {} : { driverId }),
      },
      relations: ROUTE_RELATIONS,
      order: { id: 'ASC' },
    });
    return routes
      .filter((route) => driverId === undefined || route.status !== RouteStatus.DRAFT)
      .map((route) => this.toOut(route));
  }

  async lock(id: number) {
    const route = await this.getRoute(id);
    if (route.status !== RouteStatus.DRAFT) throw new ConflictException('Chỉ chốt được tuyến DRAFT');
    if (route.driverId === null) throw new ConflictException('Tuyến chưa có tài xế');
    route.status = RouteStatus.LOCKED;
    route.lockedAt = new Date();
    await this.routes.save(route);
    return this.toOut(await this.getRoute(id));
  }

  async start(id: number) {
    const route = await this.getRoute(id);
    if (route.status !== RouteStatus.LOCKED) throw new ConflictException('Tuyến phải được chốt trước khi xuất kho');
    route.status = RouteStatus.IN_PROGRESS;
    for (const stop of route.stops || []) stop.order.status = OrderStatus.OUT_FOR_DELIVERY;
    await this.routes.save(route);
    await this.orders.save((route.stops || []).map((stop) => stop.order));
    return this.toOut(await this.getRoute(id));
  }

  async arrive(stopId: number) {
    const stop = await this.getStop(stopId);
    stop.actualArrival = stop.actualArrival || new Date();
    await this.stops.save(stop);
    return this.toOut(await this.getRoute(stop.routeId));
  }

  async complete(stopId: number, body: StopCompleteDto) {
    const stop = await this.getStop(stopId);
    if (stop.completedAt) throw new ConflictException('Điểm này đã hoàn tất');
    const now = new Date();
    stop.actualArrival = stop.actualArrival || now;
    stop.completedAt = now;
    stop.order.status = body.success ? OrderStatus.DELIVERED : OrderStatus.FAILED;
    if (body.note) stop.order.note = body.note.slice(0, 255);
    await this.stops.save(stop);
    await this.orders.save(stop.order);
    const route = await this.getRoute(stop.routeId);
    if ((route.stops || []).every((item) => item.completedAt !== null)) {
      route.status = RouteStatus.DONE;
      await this.routes.save(route);
    }
    return this.toOut(await this.getRoute(stop.routeId));
  }

  private async getRoute(id: number): Promise<DeliveryRoute> {
    const route = await this.routes.findOne({ where: { id }, relations: ROUTE_RELATIONS });
    if (!route) throw new NotFoundException('Không tìm thấy tuyến');
    return route;
  }

  private async getStop(id: number): Promise<DeliveryStop> {
    const stop = await this.stops.findOne({
      where: { id },
      relations: { route: true, order: { customer: true } },
    });
    if (!stop) throw new NotFoundException('Không tìm thấy điểm dừng');
    if (stop.route.status !== RouteStatus.IN_PROGRESS) throw new ConflictException('Tuyến chưa xuất kho');
    return stop;
  }

  private toOut(route: DeliveryRoute) {
    return {
      id: route.id,
      route_date: route.routeDate,
      status: route.status,
      vehicle: route.vehicle.plate,
      driver_id: route.driverId,
      driver_name: route.driver?.name || null,
      total_km: Number(route.totalKm),
      total_minutes: route.totalMinutes,
      baseline_km: route.baselineKm === null ? null : Number(route.baselineKm),
      solver: route.solver,
      stops: (route.stops || []).map((stop) => ({
        stop_id: stop.id,
        sequence: stop.sequence,
        order_id: stop.order.id,
        order_code: stop.order.code || '',
        customer_name: stop.order.customer.name,
        phone: stop.order.customer.phone,
        address: stop.order.address,
        lat: stop.order.lat === null ? null : Number(stop.order.lat),
        lng: stop.order.lng === null ? null : Number(stop.order.lng),
        time_window: `${shortTime(stop.order.timeWindowStart)}–${shortTime(stop.order.timeWindowEnd)}`,
        planned_arrival: stop.plannedArrival,
        eta_start: stop.etaStart,
        eta_end: stop.etaEnd,
        order_status: stop.order.status,
        completed_at: stop.completedAt,
      })),
    };
  }
}

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.slice(0, 5).split(':').map(Number);
  return hours * 60 + minutes;
}

function shortTime(value: string): string {
  return value.slice(0, 5);
}

function localMidnight(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}
