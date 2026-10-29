import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsRelations, In, Repository } from 'typeorm';
import {
  DeliveryRoute,
  DeliveryStop,
  Driver,
  Order,
  OrderHistoryEvent,
  OrderHistoryEventType,
  OrderItem,
  OrderStatus,
  PaymentStatus,
  Product,
  RouteStatus,
  Vehicle,
  Warehouse,
  SystemSetting,
} from '../database/entities';
import { buildMatrices, subsetMatrices, LatLng } from '../optimization/distance';
import { RoadMatrixService } from '../optimization/road-matrix.service';
import { etaWindow } from '../optimization/eta';
import {
  baselineKm,
  Depot,
  evaluateFixedRoute,
  optimize,
  StopSpec,
  VehicleSpec,
} from '../optimization/solver';
import { DraftRouteUpdateDto, StopCompleteDto } from './route.dto';

const ROUTE_RELATIONS: FindOptionsRelations<DeliveryRoute> = {
  driver: true,
  vehicle: true,
  warehouse: true,
  stops: { order: { customer: true, items: { product: true } } },
};

const ORDER_RELATIONS: FindOptionsRelations<Order> = {
  items: { product: true },
  stops: true,
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
    private readonly dataSource: DataSource,
    private readonly roadMatrix: RoadMatrixService,
  ) {}

  async optimize(routeDate: string, selectedVehicleIds?: number[]) {
    // Build a read-only snapshot before making a network request.
    const initialWarehouse = await this.warehouses.findOne({ where: {}, order: { id: 'ASC' } });
    if (!initialWarehouse) throw new ConflictException('Chưa khai báo kho');
    const initialDrafts = await this.routes.find({ where: { routeDate, status: RouteStatus.DRAFT }, relations: { stops: true }, order: { id: 'ASC' } });
    const draftOrderIds = initialDrafts.flatMap((route) => (route.stops || []).map((stop) => stop.orderId));
    const candidates = await this.orders.find({
      where: [{ deliveryDate: routeDate, status: OrderStatus.READY }, ...(draftOrderIds.length ? [{ id: In(draftOrderIds), deliveryDate: routeDate, status: OrderStatus.SCHEDULED }] : [])],
      relations: ORDER_RELATIONS, order: { id: 'ASC' },
    });
    const initialOrders = candidates.filter((order) => order.lat !== null && order.lng !== null
      && (!(order.stops || []).some((stop) => !stop.completedAt) || draftOrderIds.includes(order.id)));
    const initialSpecs = initialOrders.map((order) => this.orderSpec(order));
    const points: LatLng[] = [[Number(initialWarehouse.lat), Number(initialWarehouse.lng)],
      ...initialSpecs.map((stop): LatLng => [stop.lat, stop.lng])];
    const matrix = await this.roadMatrix.getMatrix(points);
    if (points.length > 1 && matrix.source !== 'ors') throw new ConflictException('Không lấy được quãng đường bộ từ OpenRouteService. Kiểm tra kết nối và cấu hình API rồi thử lại.');
    return this.dataSource.transaction(async (manager) => {
    // Khóa kho để các lần tối ưu/sửa/chốt tuyến cùng ngày không ghi đè nhau.
    const warehouse = await manager.getRepository(Warehouse).createQueryBuilder('warehouse')
      .orderBy('warehouse.id', 'ASC').setLock('pessimistic_write').getOne();
    if (!warehouse) throw new ConflictException('Chưa khai báo kho');

    // Serialize with other dispatch writes and lock order rows while validating the snapshot.
    await manager.getRepository(Order).createQueryBuilder('order')
      .where('order.deliveryDate = :routeDate', { routeDate }).setLock('pessimistic_write').getMany();
    const draftRoutes = await manager.getRepository(DeliveryRoute).find({
      where: { routeDate, status: RouteStatus.DRAFT },
      relations: { stops: { order: true } },
    });
    const draftSignature = (routes: DeliveryRoute[]) => JSON.stringify(routes.map((route) => ({
      id: route.id, vehicleId: route.vehicleId, driverId: route.driverId,
      stops: (route.stops || []).map((stop) => [stop.id, stop.orderId, stop.sequence]).sort((a, b) => a[0] - b[0]),
    })).sort((a, b) => a.id - b.id));
    if (warehouse.id !== initialWarehouse.id || Number(warehouse.lat) !== points[0][0]
      || Number(warehouse.lng) !== points[0][1] || draftSignature(draftRoutes) !== draftSignature(initialDrafts)) {
      throw new ConflictException('Dữ liệu điều phối đã thay đổi; vui lòng tối ưu lại');
    }
    for (const route of draftRoutes) {
      for (const stop of route.stops || []) {
        if (stop.order.status !== OrderStatus.SCHEDULED || stop.order.deliveryDate !== routeDate) {
          throw new ConflictException('Trạng thái đơn đã thay đổi; vui lòng kiểm tra tuyến');
        }
        await manager.getRepository(Order).update({ id: stop.orderId, status: OrderStatus.SCHEDULED }, { status: OrderStatus.READY });
        await manager.getRepository(OrderHistoryEvent).save({
          orderId: stop.orderId, eventType: OrderHistoryEventType.STATUS,
          fromValue: OrderStatus.SCHEDULED, toValue: OrderStatus.READY,
          note: 'Tối ưu lại tuyến nháp', actor: 'STAFF',
        });
      }
      await manager.getRepository(DeliveryRoute).delete(route.id);
    }

    const candidateOrders = await manager.getRepository(Order).find({
      where: { deliveryDate: routeDate, status: OrderStatus.READY },
      relations: ORDER_RELATIONS,
      order: { id: 'ASC' },
    });
    const missingLocation = candidateOrders.filter((order) => order.lat === null || order.lng === null);
    const orders = candidateOrders.filter((order) => order.lat !== null && order.lng !== null && !(order.stops || []).some((stop) => !stop.completedAt));
    const busyRoutes = await manager.getRepository(DeliveryRoute).find({ where: { routeDate } });
    const busyVehicles = new Set(busyRoutes.map((route) => route.vehicleId));
    const busyDrivers = new Set(busyRoutes.map((route) => route.driverId).filter((id): id is number => id !== null));
    const vehicles = (await manager.getRepository(Vehicle).find({ where: { active: true }, order: { id: 'ASC' } }))
      .filter((vehicle) => !busyVehicles.has(vehicle.id) && (selectedVehicleIds === undefined || selectedVehicleIds.includes(vehicle.id)));
    const drivers = (await manager.getRepository(Driver).find({ where: { active: true }, order: { id: 'ASC' } }))
      .filter((driver) => !busyDrivers.has(driver.id));

    const vehicleSpecs: VehicleSpec[] = vehicles.map((vehicle, index) => ({
      id: vehicle.id,
      capacityM3: Number(vehicle.capacityM3),
      capacityKg: Number(vehicle.capacityKg),
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
      weightKg: (order.items || []).reduce(
        (sum, item) => sum + Number(item.product.weightKg) * item.quantity, 0,
      ),
      urgent: order.isUrgent,
    }));
    const depot: Depot = { lat: Number(warehouse.lat), lng: Number(warehouse.lng) };
    if (JSON.stringify(stops) !== JSON.stringify(initialSpecs)) {
      throw new ConflictException('Đơn giao hàng đã thay đổi; vui lòng tối ưu lại');
    }
    const setting = await this.dataSource.getRepository(SystemSetting).findOne({ where: { id: 1 } }).catch(() => null);
    const result = optimize(depot, stops, vehicleSpecs, {
      dayStart: timeToMinutes(setting?.deliveryDayStart || this.config.get<string>('optimization.dayStart', '08:00')),
      dayEnd: timeToMinutes(setting?.deliveryDayEnd || this.config.get<string>('optimization.dayEnd', '18:00')),
      weightKm: setting ? Number(setting.weightKm) : this.config.get<number>('optimization.weightKm', 1),
      weightTime: setting ? Number(setting.weightTime) : this.config.get<number>('optimization.weightTime', 0.5),
      roadFactor: setting ? Number(setting.roadFactor) : this.config.get<number>('optimization.roadFactor', 1.35),
      speedKmh: setting ? Number(setting.avgSpeedKmh) : this.config.get<number>('optimization.avgSpeedKmh', 30),
      maxRouteMinutes: 480,
      matrix,
    });

    const orderById = new Map(orders.map((order) => [order.id, order]));
    const specById = new Map(stops.map((stop) => [stop.orderId, stop]));
    const created: DeliveryRoute[] = [];
    for (const plan of result.routes) {
      const ownStops = plan.stops
        .map((stop) => specById.get(stop.orderId)!)
        .sort((a, b) => a.orderId - b.orderId);
      const indices = [0, ...ownStops.map((stop) => stops.findIndex((item) => item.orderId === stop.orderId) + 1)];
      const routeMatrix = subsetMatrices(matrix, indices);
      const route = this.routes.create({
        routeDate,
        warehouseId: warehouse.id,
        driverId: plan.driverId,
        vehicleId: plan.vehicleId,
        status: RouteStatus.DRAFT,
        totalKm: String(plan.totalKm),
        totalMinutes: plan.totalMinutes,
        baselineKm: String(baselineKm(depot, ownStops, [{ id: plan.vehicleId, capacityM3: Number.MAX_SAFE_INTEGER, capacityKg: Number.MAX_SAFE_INTEGER }], 1.35, 30, routeMatrix)),
        routingMatrix: { ...routeMatrix, source: matrix.source, orderIds: ownStops.map((stop) => stop.orderId), points: indices.map((index) => points[index]) },
        solver: result.solver,
        lockedAt: null,
        stops: [],
      });
      const savedRoute = await manager.getRepository(DeliveryRoute).save(route);
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
      await manager.getRepository(DeliveryStop).save(routeStops);
      for (const plannedStop of plan.stops) {
        await manager.getRepository(Order).update(plannedStop.orderId, { status: OrderStatus.SCHEDULED });
        await manager.getRepository(OrderHistoryEvent).save({
          orderId: plannedStop.orderId, eventType: OrderHistoryEventType.STATUS,
          fromValue: OrderStatus.READY, toValue: OrderStatus.SCHEDULED,
          note: `Xếp vào tuyến ${savedRoute.id}`, actor: 'STAFF',
        });
      }
      created.push(savedRoute);
    }

    const ids = created.map((route) => route.id);
    const routes = ids.length
      ? await manager.getRepository(DeliveryRoute).find({ where: ids.map((id) => ({ id })), relations: ROUTE_RELATIONS, order: { id: 'ASC' } })
      : [];
    return {
      routes: routes.map((route) => this.toOut(route)),
      unassigned_order_codes: result.unassigned.map((id) => orderById.get(id)?.code || '').filter(Boolean),
      unassigned: result.unassigned.map((id) => {
        const spec = specById.get(id)!;
        const fits = vehicles.some((vehicle) => spec.volumeM3 <= Number(vehicle.capacityM3) && spec.weightKg <= Number(vehicle.capacityKg));
        return { order_id: id, code: orderById.get(id)?.code || '', reason: !vehicles.length ? 'NO_VEHICLE' : fits ? 'TIME_WINDOW_OR_SHIFT' : 'CAPACITY' };
      }),
      missing_location_codes: missingLocation.map((order) => order.code || '').filter(Boolean),
      total_km: result.totalKm,
      baseline_km: result.baselineKm,
      saving_percent: result.savingPercent,
      solver: result.solver,
      distance_source: matrix.source,
    };
    });
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

  async detail(id: number) {
    return this.toOut(await this.getRoute(id));
  }

  async roadGeometry(id: number) {
    const route = await this.getRoute(id);
    const depot = route.routingMatrix?.points?.[0] || (route.warehouse ? [Number(route.warehouse.lat), Number(route.warehouse.lng)] : null);
    const stops = [...(route.stops || [])].sort((a, b) => a.sequence - b.sequence);
    if (!depot || stops.some((stop) => stop.order.lat == null || stop.order.lng == null)) {
      throw new ConflictException('Tuyến thiếu tọa độ để hiển thị đường đi');
    }
    const points: LatLng[] = [[Number(depot[0]), Number(depot[1])],
      ...stops.map((stop): LatLng => [Number(stop.order.lat), Number(stop.order.lng)]),
      [Number(depot[0]), Number(depot[1])]];
    return { coordinates: await this.roadMatrix.getGeometry(points) };
  }

  async editDraft(id: number, body: DraftRouteUpdateDto) {
    return this.dataSource.transaction(async (manager) => {
      const warehouse = await manager.getRepository(Warehouse).createQueryBuilder('warehouse')
        .orderBy('warehouse.id', 'ASC').setLock('pessimistic_write').getOne();
      if (!warehouse) throw new ConflictException('Chưa khai báo kho');
      const repo = manager.getRepository(DeliveryRoute);
      const route = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!route) throw new NotFoundException('Không tìm thấy tuyến');
      if (route.status !== RouteStatus.DRAFT) throw new ConflictException('Chỉ sửa được tuyến nháp');
      const stops = await manager.getRepository(DeliveryStop).find({
        where: { routeId: id }, relations: { order: { items: { product: true } } }, order: { sequence: 'ASC' },
      });
      const orderIds = body.order_ids || stops.map((stop) => stop.orderId);
      if (orderIds.length !== stops.length || new Set(orderIds).size !== stops.length || orderIds.some((orderId) => !stops.some((stop) => stop.orderId === orderId))) {
        throw new BadRequestException('Danh sách điểm phải gồm đúng các đơn hiện có trong tuyến');
      }
      const vehicleId = body.vehicle_id ?? route.vehicleId;
      const driverId = body.driver_id === undefined ? route.driverId : body.driver_id;
      const vehicle = await manager.getRepository(Vehicle).findOne({ where: { id: vehicleId, active: true } });
      if (!vehicle) throw new ConflictException('Xe không hoạt động');
      if (driverId !== null) {
        const driver = await manager.getRepository(Driver).findOne({ where: { id: driverId, active: true } });
        if (!driver) throw new ConflictException('Tài xế không hoạt động');
      }
      const otherRoutes = await repo.find({ where: { routeDate: route.routeDate } });
      if (otherRoutes.some((other) => other.id !== id && other.vehicleId === vehicleId)) throw new ConflictException('Xe đã có tuyến trong ngày');
      if (driverId !== null && otherRoutes.some((other) => other.id !== id && other.driverId === driverId)) throw new ConflictException('Tài xế đã có tuyến trong ngày');
      const byId = new Map(stops.map((stop) => [stop.orderId, stop]));
      const specs = orderIds.map((orderId) => this.orderSpec(byId.get(orderId)!.order));
      const routeWarehouse = route.warehouseId === warehouse.id ? warehouse : await manager.getRepository(Warehouse).findOne({ where: { id: route.warehouseId } });
      if (!routeWarehouse) throw new ConflictException('Không tìm thấy kho của tuyến');
      const depot = { lat: Number(routeWarehouse.lat), lng: Number(routeWarehouse.lng) };
      const options = await this.solverOptions();
      const stored = route.routingMatrix;
      const currentPoints: LatLng[] = [[depot.lat, depot.lng], ...specs.map((spec): LatLng => [spec.lat, spec.lng])];
      let routeMatrix;
      if (stored) {
        const indices = [0, ...orderIds.map((orderId) => stored.orderIds.indexOf(orderId) + 1)];
        if (indices.some((index, i) => index < 0 || (i > 0 && index === 0)
          || JSON.stringify(stored.points[index]) !== JSON.stringify(currentPoints[i]))) {
          throw new ConflictException('Tọa độ đã thay đổi; vui lòng tối ưu lại');
        }
        routeMatrix = subsetMatrices(stored, indices);
      } else {
        routeMatrix = buildMatrices(currentPoints, options.roadFactor, options.speedKmh);
      }
      const plan = evaluateFixedRoute(depot, specs, {
        id: vehicle.id, capacityM3: Number(vehicle.capacityM3), capacityKg: Number(vehicle.capacityKg), driverId,
      }, { ...options, matrix: routeMatrix });
      if (!plan) throw new ConflictException('Thứ tự/xe đã chọn vi phạm khung giờ, tải trọng hoặc ca 8 giờ');
      await manager.query('UPDATE delivery_stop SET sequence = -sequence WHERE route_id = ?', [id]);
      for (const point of plan.stops) {
        const stop = byId.get(point.orderId)!;
        const planned = new Date(localMidnight(route.routeDate).getTime() + point.arrivalMin * 60_000);
        const [etaStart, etaEnd] = etaWindow(planned, point.sequence);
        await manager.getRepository(DeliveryStop).update(stop.id, {
          sequence: point.sequence, plannedArrival: planned, etaStart, etaEnd,
        });
      }
      const sortedByOrder = [...specs].sort((a, b) => a.orderId - b.orderId);
      await repo.update(id, {
        vehicleId, driverId, totalKm: String(plan.totalKm), totalMinutes: plan.totalMinutes,
        baselineKm: String(baselineKm(depot, sortedByOrder, [{ id: vehicle.id, capacityM3: Number.MAX_SAFE_INTEGER, capacityKg: Number.MAX_SAFE_INTEGER }], options.roadFactor, options.speedKmh,
          subsetMatrices(routeMatrix, [0, ...sortedByOrder.map((spec) => orderIds.indexOf(spec.orderId) + 1)]))),
        routingMatrix: { ...routeMatrix, source: stored?.source ?? 'estimate', orderIds, points: currentPoints },
      });
      return this.toOut((await repo.findOne({ where: { id }, relations: ROUTE_RELATIONS }))!);
    });
  }

  async lock(id: number) {
    return this.dataSource.transaction(async (manager) => {
      await manager.getRepository(Warehouse).createQueryBuilder('warehouse')
        .orderBy('warehouse.id', 'ASC').setLock('pessimistic_write').getOne();
      const repo = manager.getRepository(DeliveryRoute);
      const route = await repo.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!route) throw new NotFoundException('Không tìm thấy tuyến');
      if (route.status !== RouteStatus.DRAFT) throw new ConflictException('Chỉ chốt được tuyến DRAFT');
      if (route.driverId === null) throw new ConflictException('Tuyến chưa có tài xế');
      const driver = await manager.getRepository(Driver).findOne({ where: { id: route.driverId, active: true } });
      const vehicle = await manager.getRepository(Vehicle).findOne({ where: { id: route.vehicleId, active: true } });
      if (!driver || !vehicle) throw new ConflictException('Tài xế hoặc xe không còn hoạt động');
      const count = await manager.getRepository(DeliveryStop).count({ where: { routeId: id } });
      if (!count || route.totalMinutes > 480) throw new ConflictException('Tuyến rỗng hoặc vượt ca 8 giờ');
      route.status = RouteStatus.LOCKED;
      route.lockedAt = new Date();
      await repo.save(route);
      return this.toOut((await repo.findOne({ where: { id }, relations: ROUTE_RELATIONS }))!);
    });
  }

  async driverRoutes(driverId: number | null, routeDate?: string) {
    if (!driverId) throw new ForbiddenException('Tài khoản chưa được liên kết với tài xế');
    const routes = await this.routes.find({ where: { driverId, status: In([RouteStatus.LOCKED, RouteStatus.IN_PROGRESS, RouteStatus.DONE]), ...(routeDate ? { routeDate } : {}) }, relations: ROUTE_RELATIONS, order: { routeDate: 'DESC', id: 'DESC' } });
    return routes.map(route => this.toOut(route));
  }

  async start(id: number, driverId?: number | null, actor = 'STAFF') {
    await this.dataSource.transaction(async manager => {
      const routes = manager.getRepository(DeliveryRoute);
      const route = await routes.findOne({ where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!route) throw new NotFoundException('Không tìm thấy tuyến');
      this.assertDriver(route, driverId);
      if (route.status !== RouteStatus.LOCKED) throw new ConflictException('Tuyến phải được chốt trước khi xuất kho');
      const stops = await manager.getRepository(DeliveryStop).find({ where: { routeId: id } });
      if (!stops.length) throw new ConflictException('Tuyến không có điểm giao');
      for (const stop of stops) {
        const repo = manager.getRepository(Order);
        const order = await repo.findOne({ where: { id: stop.orderId }, lock: { mode: 'pessimistic_write' } });
        if (!order || order.status !== OrderStatus.SCHEDULED) throw new ConflictException('Trạng thái đơn không hợp lệ');
        await repo.update(order.id, { status: OrderStatus.OUT_FOR_DELIVERY });
        await manager.getRepository(OrderHistoryEvent).save({ orderId: order.id, eventType: OrderHistoryEventType.STATUS, fromValue: OrderStatus.SCHEDULED, toValue: OrderStatus.OUT_FOR_DELIVERY, note: `Xuất phát tuyến ${id}`, actor });
      }
      await routes.update(id, { status: RouteStatus.IN_PROGRESS });
    });
    return this.toOut(await this.getRoute(id));
  }

  async arrive(stopId: number, driverId?: number | null) {
    const routeId = await this.dataSource.transaction(async manager => {
      const [record] = await manager.query('SELECT route_id FROM delivery_stop WHERE id=?', [stopId]);
      if (!record) throw new NotFoundException('Không tìm thấy điểm dừng');
      const route = await manager.getRepository(DeliveryRoute).findOne({ where: { id: record.route_id }, lock: { mode: 'pessimistic_write' } });
      if (!route) throw new NotFoundException('Không tìm thấy tuyến');
      this.assertDriver(route, driverId);
      if (route.status !== RouteStatus.IN_PROGRESS) throw new ConflictException('Tuyến chưa xuất kho hoặc đã kết thúc');
      const repo = manager.getRepository(DeliveryStop);
      const stop = await repo.findOne({ where: { id: stopId }, lock: { mode: 'pessimistic_write' } });
      if (!stop || stop.completedAt) throw new ConflictException('Điểm này đã hoàn tất');
      const pending = await repo.find({ where: { routeId: route.id }, order: { sequence: 'ASC' } });
      if (pending.find(item => !item.completedAt)?.id !== stop.id) throw new ConflictException('Cần xử lý điểm giao trước theo thứ tự');
      if (!stop.actualArrival) await repo.update(stopId, { actualArrival: new Date() });
      return route.id;
    });
    return this.toOut(await this.getRoute(routeId));
  }

  async complete(stopId: number, body: StopCompleteDto, driverId?: number | null, actor = 'STAFF') {
    const routeId = await this.dataSource.transaction(async manager => {
      const [record] = await manager.query('SELECT route_id FROM delivery_stop WHERE id=?', [stopId]);
      if (!record) throw new NotFoundException('Không tìm thấy điểm dừng');
      const routes = manager.getRepository(DeliveryRoute);
      const route = await routes.findOne({ where: { id: record.route_id }, lock: { mode: 'pessimistic_write' } });
      if (!route) throw new NotFoundException('Không tìm thấy tuyến');
      this.assertDriver(route, driverId);
      if (route.status !== RouteStatus.IN_PROGRESS) throw new ConflictException('Tuyến chưa xuất kho hoặc đã kết thúc');
      const stops = manager.getRepository(DeliveryStop);
      const stop = await stops.findOne({ where: { id: stopId }, lock: { mode: 'pessimistic_write' } });
      if (!stop || stop.completedAt) throw new ConflictException('Điểm này đã hoàn tất');
      const pending = await stops.find({ where: { routeId: route.id }, order: { sequence: 'ASC' } });
      if (pending.find(item => !item.completedAt)?.id !== stop.id) throw new ConflictException('Cần xử lý điểm giao trước theo thứ tự');
      if (!stop.actualArrival) throw new ConflictException('Cần ghi nhận đã đến trước khi hoàn tất');
      if (!body.success && !body.note?.trim()) throw new BadRequestException('Cần lý do giao không thành công');
      const orders = manager.getRepository(Order);
      const order = await orders.findOne({ where: { id: stop.orderId }, lock: { mode: 'pessimistic_write' } });
      if (!order || order.status !== OrderStatus.OUT_FOR_DELIVERY) throw new ConflictException('Trạng thái đơn không hợp lệ');
      const expectedCod = body.success && order.paymentMethod === 'COD' && order.paymentStatus !== PaymentStatus.PAID ? Number(order.total) : 0;
      if ((body.cod_collected ?? 0) !== expectedCod) throw new BadRequestException(expectedCod ? 'Cần xác nhận đúng số tiền COD đã thu' : 'Đơn này không cần thu COD');
      const result = body.success ? OrderStatus.DELIVERED : OrderStatus.FAILED;
      await stops.update(stopId, { completedAt: new Date(), result, resultNote: body.note?.trim() || null, codCollected: String(expectedCod) });
      await orders.update(order.id, { status: result, ...(expectedCod ? { paymentStatus: PaymentStatus.PAID } : {}) });
      await manager.getRepository(OrderHistoryEvent).save({ orderId: order.id, eventType: OrderHistoryEventType.STATUS, fromValue: OrderStatus.OUT_FOR_DELIVERY, toValue: result, note: body.note?.trim() || null, actor });
      if (expectedCod) await manager.getRepository(OrderHistoryEvent).save({ orderId: order.id, eventType: OrderHistoryEventType.PAYMENT, fromValue: order.paymentStatus, toValue: PaymentStatus.PAID, note: `Thu COD ${expectedCod}`, actor });
      if (pending.every(item => item.id === stopId || !!item.completedAt)) await routes.update(route.id, { status: RouteStatus.DONE });
      return route.id;
    });
    return this.toOut(await this.getRoute(routeId));
  }

  async reschedule(orderId: number, date: string, actor: string) {
    const parsed = new Date(`${date}T00:00:00`);
    if (Number.isNaN(parsed.getTime()) || `${parsed.getFullYear()}-${String(parsed.getMonth()+1).padStart(2,'0')}-${String(parsed.getDate()).padStart(2,'0')}` !== date) throw new BadRequestException('Ngày giao không hợp lệ');
    await this.dataSource.transaction(async manager => {
      const orders = manager.getRepository(Order);
      const order = await orders.findOne({ where: { id: orderId }, lock: { mode: 'pessimistic_write' } });
      if (!order) throw new NotFoundException('Không tìm thấy đơn');
      if (order.status !== OrderStatus.FAILED) throw new ConflictException('Chỉ xếp lại đơn giao thất bại');
      const today = new Date(); today.setHours(0,0,0,0);
      if (parsed < today || date <= order.deliveryDate) throw new BadRequestException('Ngày giao lại phải sau ngày giao cũ và không ở quá khứ');
      const active = await manager.query('SELECT id FROM delivery_stop WHERE order_id=? AND completed_at IS NULL', [orderId]);
      if (active.length) throw new ConflictException('Đơn đang có điểm giao chưa hoàn tất');
      await orders.update(orderId, { status: OrderStatus.READY, deliveryDate: date });
      await manager.getRepository(OrderHistoryEvent).save({ orderId, eventType: OrderHistoryEventType.STATUS, fromValue: OrderStatus.FAILED, toValue: OrderStatus.READY, note: `Hẹn giao lại ngày ${date}`, actor });
    });
    return { id: orderId, status: OrderStatus.READY, delivery_date: date };
  }

  private assertDriver(route: DeliveryRoute, driverId?: number | null) {
    if (driverId !== undefined && (!driverId || route.driverId !== driverId)) throw new ForbiddenException('Tuyến không được phân công cho tài khoản này');
  }

  private orderSpec(order: Order): StopSpec {
    return {
      orderId: order.id, lat: Number(order.lat), lng: Number(order.lng),
      twStart: timeToMinutes(order.timeWindowStart), twEnd: timeToMinutes(order.timeWindowEnd),
      serviceMin: UNLOAD_MINUTES + (order.items || []).reduce((sum, item) => sum + item.product.installMinutes * item.quantity, 0),
      volumeM3: (order.items || []).reduce((sum, item) => sum + Number(item.product.volumeM3) * item.quantity, 0),
      weightKg: (order.items || []).reduce((sum, item) => sum + Number(item.product.weightKg) * item.quantity, 0),
      urgent: order.isUrgent,
    };
  }

  private async solverOptions() {
    const setting = await this.dataSource.getRepository(SystemSetting).findOne({ where: { id: 1 } }).catch(() => null);
    return {
      dayStart: timeToMinutes(setting?.deliveryDayStart || this.config.get<string>('optimization.dayStart', '08:00')),
      dayEnd: timeToMinutes(setting?.deliveryDayEnd || this.config.get<string>('optimization.dayEnd', '18:00')),
      roadFactor: setting ? Number(setting.roadFactor) : this.config.get<number>('optimization.roadFactor', 1.35),
      speedKmh: setting ? Number(setting.avgSpeedKmh) : this.config.get<number>('optimization.avgSpeedKmh', 30),
      maxRouteMinutes: 480,
    };
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
      code: `R${route.routeDate.replace(/-/g, '')}-${route.id}`,
      route_date: route.routeDate,
      status: route.status,
      vehicle_id: route.vehicleId,
      vehicle: route.vehicle.plate,
      vehicle_capacity_m3: Number(route.vehicle.capacityM3),
      vehicle_capacity_kg: Number(route.vehicle.capacityKg),
      driver_id: route.driverId,
      driver_name: route.driver?.name || null,
      total_km: Number(route.totalKm),
      total_minutes: route.totalMinutes,
      baseline_km: route.baselineKm === null ? null : Number(route.baselineKm),
      solver: route.solver,
      distance_source: route.routingMatrix?.source ?? 'estimate',
      depot: route.routingMatrix?.points?.[0] ? { lat: route.routingMatrix.points[0][0], lng: route.routingMatrix.points[0][1] } : route.warehouse ? { lat: Number(route.warehouse.lat), lng: Number(route.warehouse.lng) } : null,
      locked_at: route.lockedAt,
      created_at: route.createdAt,
      stops: [...(route.stops || [])].sort((a, b) => a.sequence - b.sequence).map((stop) => ({
        stop_id: stop.id,
        sequence: stop.sequence,
        order_id: stop.order.id,
        order_code: stop.order.code || '',
        customer_name: stop.order.recipientName || stop.order.customer.name,
        phone: stop.order.recipientPhone || stop.order.customer.phone,
        items: (stop.order.items || []).map(item => ({ name: item.product.name, quantity: item.quantity, install_minutes: item.product.installMinutes })),
        note: stop.order.note,
        payment_method: stop.order.paymentMethod,
        payment_status: stop.order.paymentStatus,
        total: Number(stop.order.total),
        address: stop.order.address,
        lat: stop.order.lat === null ? null : Number(stop.order.lat),
        lng: stop.order.lng === null ? null : Number(stop.order.lng),
        time_window: `${shortTime(stop.order.timeWindowStart)}–${shortTime(stop.order.timeWindowEnd)}`,
        planned_arrival: stop.plannedArrival,
        eta_start: stop.etaStart,
        eta_end: stop.etaEnd,
        order_status: stop.order.status,
        is_urgent: stop.order.isUrgent,
        actual_arrival: stop.actualArrival,
        completed_at: stop.completedAt,
        result: stop.result,
        result_note: stop.resultNote,
        cod_collected: Number(stop.codCollected || 0),
        has_proof: !!stop.proofUploadedAt,
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
