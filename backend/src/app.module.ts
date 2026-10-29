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
  SystemSetting,
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

function parseDatabaseUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    return {
      host: url.hostname,
      port: Number(url.port || 3306),
      username: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.replace(/^\//, ''),
      sslMode: url.searchParams.get('ssl-mode') || url.searchParams.get('ssl'),
    };
  } catch {
    const match = rawUrl.match(/^(?:mysql:\/\/)?([^:]+):(.*)@([^:/]+)(?::(\d+))?\/(.*)$/);
    if (match) {
      const [, username, password, host, port, dbAndQuery] = match;
      const [database, query] = (dbAndQuery || '').split('?');
      const searchParams = new URLSearchParams(query || '');
      return {
        host,
        port: Number(port || 3306),
        username: decodeURIComponent(username),
        password: decodeURIComponent(password),
        database,
        sslMode: searchParams.get('ssl-mode') || searchParams.get('ssl'),
      };
    }
    return null;
  }
}

function databaseOptions(config: ConfigService) {
  const rawUrl = (config.get<string>('database.url') || '').trim();
  const parsed = rawUrl ? parseDatabaseUrl(rawUrl) : null;

  const host = parsed?.host || config.get<string>('database.host') || '127.0.0.1';
  const port = parsed?.port || config.get<number>('database.port') || 3306;
  const username = parsed?.username || config.get<string>('database.username') || 'thongvan';
  const password = parsed?.password !== undefined ? parsed.password : (config.get<string>('database.password') || 'thongvan');
  const database = parsed?.database || config.get<string>('database.name') || 'thongvan';

  const useSsl =
    parsed?.sslMode === 'REQUIRED' ||
    parsed?.sslMode === 'true' ||
    process.env.DATABASE_SSL === 'true' ||
    host.includes('aivencloud.com');

  return {
    type: 'mysql' as const,
    host,
    port,
    username,
    password,
    database,
    charset: 'utf8mb4',
    ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
    entities: [
      Category,
      AuditEvent,
      MaintenanceRecord,
      MaintenanceReminderRead,
      Customer,
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
      SystemSetting,
    ],
    synchronize: false,
  };
}
