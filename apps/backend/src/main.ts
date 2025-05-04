import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { AppModule } from './app.module';

async function bootstrap() {
  // Node.js v22 성능 최적화
  const app = await NestFactory.create(AppModule, {
    // Use built-in logger during startup, will be replaced with Winston
    logger: ['error', 'warn', 'log'],
    cors: {
      origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'https://localhost:5002'],
      credentials: true, // Allow cookies in CORS requests
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    },
    abortOnError: false,
  });

  // Use Winston logger
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  // 쿠키 파서 미들웨어 등록
  app.use(cookieParser());

  app.setGlobalPrefix('api');
  
  // 전역 검증 파이프 설정
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true
    }),
  );
  
  // HTTP/3 (QUIC) 지원 설정
  // Node.js v22의 향상된 HTTP 기능 활용
  app.enableShutdownHooks();
  
  await app.listen(3000);
  
  const logger = app.get(WINSTON_MODULE_NEST_PROVIDER);
  logger.log(`Application is running on: ${await app.getUrl()}`, 'Bootstrap');
}

bootstrap(); 