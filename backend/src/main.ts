import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import express, { Express, Request, Response } from 'express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';

let cachedServer: Express;

export async function bootstrapServer(): Promise<Express> {
  if (!cachedServer) {
    const expressApp = express();
    const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp));
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

    await app.init();
    cachedServer = expressApp;
  }
  return cachedServer;
}

export default async function handler(req: Request, res: Response) {
  try {
    const server = await bootstrapServer();
    return server(req, res);
  } catch (err: any) {
    console.error('[Backend Bootstrap Error]:', err);
    return res.status(500).json({
      statusCode: 500,
      message: `Lỗi kết nối hoặc khởi động backend: ${err?.message || String(err)}`,
      error: err?.message || String(err),
    });
  }
}

if (!process.env.VERCEL) {
  void (async () => {
    try {
      const server = await bootstrapServer();
      const port = Number(process.env.PORT || 8000);
      server.listen(port, () => {
        console.log(`Backend server running on http://localhost:${port}`);
      });
    } catch (err) {
      console.error('[NestJS Local Startup Error]:', err);
      process.exit(1);
    }
  })();
}
