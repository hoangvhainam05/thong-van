import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from './config/configuration';
import {
  Customer,
  Category,
  AuditEvent,
  MaintenanceRecord,
  MaintenanceReminderRead,
  DeliveryRoute,
  DeliveryStop,
  Driver,
  Order,
  OrderHistoryEvent,
  OrderItem,
  Product,
  Permission,
  Role,
  User,
  UserNotificationRead,
  Vehicle,
  Warehouse,
} from './database/entities';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { OrdersModule } from './orders/orders.module';
import { ProductsModule } from './products/products.module';
import { RoutesModule } from './routes/routes.module';
import { SystemModule } from './system/system.module';
import { TrackingModule } from './tracking/tracking.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => databaseOptions(config),
    }),
    AuthModule,
    AdminModule,
    ProductsModule,
    OrdersModule,
    RoutesModule,
    TrackingModule,
    SystemModule,
  ],
})
export class AppModule {}

function databaseOptions(config: ConfigService) {
  const rawUrl = config.get<string>('database.url');
  if (rawUrl) {
    const url = new URL(rawUrl);
    return {
      type: 'mysql' as const,
      host: url.hostname,
      port: Number(url.port || 3306),
      username: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.replace(/^\//, ''),
      charset: 'utf8mb4',
      entities: [Category, AuditEvent, MaintenanceRecord, MaintenanceReminderRead, Customer, DeliveryRoute, DeliveryStop, Driver, Order, OrderHistoryEvent, OrderItem, Product, Permission, Role, User, UserNotificationRead, Vehicle, Warehouse],
      synchronize: false,
    };
  }
  return {
    type: 'mysql' as const,
    host: config.get<string>('database.host'),
    port: config.get<number>('database.port'),
    username: config.get<string>('database.username'),
    password: config.get<string>('database.password'),
    database: config.get<string>('database.name'),
    charset: 'utf8mb4',
    entities: [Category, AuditEvent, MaintenanceRecord, MaintenanceReminderRead, Customer, DeliveryRoute, DeliveryStop, Driver, Order, OrderHistoryEvent, OrderItem, Product, Permission, Role, User, UserNotificationRead, Vehicle, Warehouse],
    synchronize: false,
  };
}
