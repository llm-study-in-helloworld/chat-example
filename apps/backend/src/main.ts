import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
// @ts-ignore
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  // Node.js v22 성능 최적화
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
    cors: {
      origin: true,
      credentials: true // Allow cookies in CORS requests
    },
    abortOnError: false,
  });

  // 쿠키 파서 미들웨어 등록
  // @ts-ignore
  app.use(cookieParser());

  app.setGlobalPrefix('api');
  
  // 전역 검증 파이프 설정
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  
  // HTTP/3 (QUIC) 지원 설정
  // Node.js v22의 향상된 HTTP 기능 활용
  app.enableShutdownHooks();
  
  await app.listen(3000);
  console.info(`Application is running on: ${await app.getUrl()}`);
}

bootstrap(); 