import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import express from 'express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';

async function bootstrap(): Promise<void> {
  const port = Number(process.env.PORT || 8000);
  try {
    const app = await NestFactory.create(AppModule);
    const config = app.get(ConfigService);
    const corsOrigins = config.get<string[] | boolean>('corsOrigins', ['http://localhost:3000']);
    app.enableCors({
      origin: corsOrigins,
      methods: '*',
      allowedHeaders: '*',
    });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());

    const swaggerConfig = new DocumentBuilder()
      .setTitle('Thông Vân — Order & Delivery Optimization API')
      .setDescription('Hệ thống quản lý đơn hàng và tối ưu hoá giao hàng thông minh')
      .setVersion('0.1.0')
      .build();
    const swaggerDoc = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, swaggerDoc);
    SwaggerModule.setup('api/docs', app, swaggerDoc);

    await app.listen(port);
    console.log(`[Bootstrap] NestJS running successfully on port ${port}`);
  } catch (err: any) {
    console.error('[Bootstrap Critical Error]:', err);

    // Fallback server so Vercel doesn't crash with FUNCTION_INVOCATION_FAILED
    // and returns the exact error details to HTTP callers
    const fallback = express();
    fallback.use((_req, res) => {
      res.status(500).json({
        statusCode: 500,
        error: 'BACKEND_STARTUP_FAILED',
        message: `Lỗi kết nối cơ sở dữ liệu hoặc khởi động: ${err?.message || String(err)}`,
        detail: err?.message || String(err),
        dbConfig: {
          hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
          dbHost: process.env.DB_HOST || (process.env.DATABASE_URL ? 'from DATABASE_URL' : '127.0.0.1 (mặc định)'),
          dbPort: process.env.DB_PORT || (process.env.DATABASE_URL ? 'from DATABASE_URL' : '3306 (mặc định)'),
          dbDatabase: process.env.DB_DATABASE || (process.env.DATABASE_URL ? 'from DATABASE_URL' : 'thongvan (mặc định)'),
          databaseSsl: process.env.DATABASE_SSL || '(chưa đặt)',
        },
      });
    });

    fallback.listen(port, () => {
      console.log(`[Bootstrap] Fallback error server listening on port ${port}`);
    });
  }
}

void bootstrap();
