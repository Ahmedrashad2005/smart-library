import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { GlobalExceptionFilter, ResponseInterceptor } from './common/http';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173', credentials: true });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());
  SwaggerModule.setup(
    'api/docs',
    app,
    SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('NAWA Unified Knowledge Platform API')
        .setDescription('APIs for NAWA Store-facing catalog, NAWA Campus, and shared services.')
        .setVersion('1.0')
        .addBearerAuth()
        .addCookieAuth(process.env.COOKIE_NAME ?? 'smart_library_refresh')
        .build(),
    ),
  );
  await app.listen(Number(process.env.BACKEND_PORT ?? 3000));
}

void bootstrap();
