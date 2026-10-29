import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';

async function bootstrap(): Promise<void> {
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

  await app.listen(config.get<number>('port', 8000));
}

void bootstrap();
