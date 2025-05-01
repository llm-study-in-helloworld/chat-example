import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { EntityManager, MikroORM } from '@mikro-orm/core';
import { User } from '../../src/entities';
import * as bcrypt from 'bcrypt';
import { AppTestModule } from '../app-test.module';
import testConfig from '../mikro-orm.config.test';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let em: EntityManager;
  let authToken: string;
  let orm: MikroORM;

  // Test user data
  const testUser = {
    email: 'auth-test@example.com',
    password: 'password123',
    nickname: 'AuthTestUser'
  };
  
  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppTestModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    em = app.get<EntityManager>(EntityManager);
    orm = app.get<MikroORM>(MikroORM);

    await orm.getSchemaGenerator().refreshDatabase();
    
    // Apply middleware and pipes
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
    
    // Create a test user for authentication tests
    await request(app.getHttpServer())
      .post('/api/auth/signup')
      .send(testUser)
      .expect(201);
  });
  
  afterAll(async () => {
    await app.close();
    await orm.close();
  });
  
  describe('Feature: User Registration', () => {
    it('Scenario: User signs up with valid credentials', async () => {
      // Given a new user with valid credentials
      const newUser = {
        email: 'new-user@example.com',
        password: 'password123',
        nickname: 'NewUser'
      };
      
      // When they sign up
      const response = await request(app.getHttpServer())
        .post('/api/auth/signup')
        .send(newUser)
        .expect(201);
      
      // Then they should receive their user info
      expect(response.body).toBeDefined();
      expect(response.body.email).toBe(newUser.email);
      expect(response.body.nickname).toBe(newUser.nickname);
    });
  });
  
  describe('Feature: JWT Authentication', () => {
    it('Scenario: User logs in and receives a JWT token', async () => {
      // Given a registered user
      const loginData = {
        email: testUser.email,
        password: testUser.password
      };
      
      // When they log in
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send(loginData)
        .expect(201);
      
      // Then they should receive a JWT token
      expect(response.body.token).toBeDefined();
      expect(typeof response.body.token).toBe('string');
      
      // And the token should be set as a cookie
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.split(';').some((cookie: string) => cookie.includes('jwt='))).toBe(true);
      
      // Save token for later tests
      authToken = response.body.token;
    });
    
    it('Scenario: User uses JWT token to access protected resources', async () => {
      // Given an authenticated user with a valid token
      
      // When they access a protected resource
      const response = await request(app.getHttpServer())
        .get('/api/users/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      // Then they should receive the protected resource
      expect(response.body).toBeDefined();
      expect(response.body.email).toBe(testUser.email);
    });
    
    it('Scenario: Accessing protected resources without token fails', async () => {
      // Given no authentication token
      
      // When trying to access a protected resource
      await request(app.getHttpServer())
        .get('/api/users/me')
        .expect(401); // Unauthorized
    });
    
    it('Scenario: Using an invalid token fails', async () => {
      // Given an invalid token
      const invalidToken = 'invalid.jwt.token';
      
      // When trying to access a protected resource
      await request(app.getHttpServer())
        .get('/api/users/me')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(401); // Unauthorized
    });
  });
  
  describe('Feature: Token Blacklisting', () => {
    it('Scenario: Blacklisted tokens are rejected', async () => {
      // Given a valid token that we will blacklist
      const loginData = {
        email: testUser.email,
        password: testUser.password
      };
      
      const loginResponse = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send(loginData)
        .expect(201);
      
      const tokenToBlacklist = loginResponse.body.token;
      
      // When we logout (which blacklists the token)
      await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${tokenToBlacklist}`)
        .expect(200);
      
      // Then the token should be rejected for future requests
      await request(app.getHttpServer())
        .get('/api/users/me')
        .set('Authorization', `Bearer ${tokenToBlacklist}`)
        .expect(401); // Unauthorized
    });
  });
  
  describe('Feature: Cookie Authentication', () => {
    it('Scenario: Authentication works via cookies', async () => {
      // Given a successful login that sets cookies
      const agent = request.agent(app.getHttpServer());
      
      const loginResponse = await agent
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(201);
      
      // The agent should now have the cookie set
      
      // When accessing a protected resource with the cookie
      const response = await agent
        .get('/api/users/me')
        .expect(200);
      
      // Then they should receive the protected resource
      expect(response.body).toBeDefined();
      expect(response.body.email).toBe(testUser.email);
    });
    
    it('Scenario: Cookies are cleared on logout', async () => {
      // Given an authenticated agent
      const agent = request.agent(app.getHttpServer());
      
      await agent
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(201);
      
      // When they logout
      const logoutResponse = await agent
        .post('/api/auth/logout')
        .expect(200);
      
      // Then the cookies should be cleared
      const cookies = logoutResponse.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.split(';').some((cookie: string) => 
        cookie.includes('jwt=;') || 
        cookie.includes('Expires=Thu, 01 Jan 1970'))
      ).toBe(true);
      
      // And they should no longer be able to access protected resources
      await agent
        .get('/api/users/me')
        .expect(401);
    });
  });
  
  describe('Feature: Account Deletion', () => {
    it('Scenario: User can delete their account', async () => {
      // First login to get a token
      const loginResponse = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(201);
      
      const token = loginResponse.body.token;
      
      // When they delete their account
      const deleteResponse = await request(app.getHttpServer())
        .delete('/api/auth/signout')
        .set('Authorization', `Bearer ${token}`)
        .send({ password: testUser.password })
        .expect(200);
      
      // Then they should receive a success message
      expect(deleteResponse.body.message).toContain('success');
      
      // And they should no longer be able to login
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(401); // Unauthorized
    });
  });
}); 