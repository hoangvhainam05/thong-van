import 'reflect-metadata';
import { IncomingMessage, ServerResponse } from 'node:http';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';

async function bootstrap() {
  const port = Number(process.env.PORT || 8000);
  try {
    const app = await NestFactory.create(AppModule, { abortOnError: false });
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

    if (process.env.VERCEL) {
      await app.init();
    } else {
      await app.listen(port);
      console.log(`[Bootstrap] NestJS running successfully on port ${port}`);
    }
    return app.getHttpAdapter().getInstance();
  } catch (err: any) {
    console.error('[Bootstrap Critical Error]:', err);
    throw err;
  }
}

let application: ReturnType<typeof bootstrap> | undefined;
export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    application ??= bootstrap();
    const expressApp = await application;
    expressApp(req, res);
  } catch {
    application = undefined;
    res.statusCode = 503;
    res.end('Backend unavailable');
  }
}

if (!process.env.VERCEL) void bootstrap();
