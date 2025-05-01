import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppTestModule } from '../app-test.module';
import { EntityManager } from '@mikro-orm/core';
import { MikroORM } from '@mikro-orm/core';
import testConfig from '../mikro-orm.config.test';

describe('AppController (e2e)', () => {
  let app: INestApplication;
  let em: EntityManager;
  let orm: MikroORM;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppTestModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    orm = app.get<MikroORM>(MikroORM);
    em = app.get<EntityManager>(EntityManager);

    await orm.getSchemaGenerator().refreshDatabase();
    
    // Apply the same middleware and pipes as in main.ts
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    
    await app.init();
  });

  afterAll(async () => {
    // Drop all tables
    await app?.close();
    await orm.close();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/api')
      .expect(404); // We don't have a root endpoint defined
  });
}); 