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
  let orm: MikroORM;

  // Base test user data
  const baseTestUser = {
    password: 'password123',
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
  });
  
  afterAll(async () => {
    await app.close();
    await orm.close();
  });

  // Helper function to create a test user
  const createTestUser = async (index: number) => {
    // Add a random string to ensure uniqueness
    const uniqueId = `${index}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const userData = {
      email: `auth-test-${uniqueId}@example.com`,
      password: baseTestUser.password,
      nickname: `AuthTestUser${uniqueId}`
    };
    
    await request(app.getHttpServer())
      .post('/api/auth/signup')
      .send(userData)
      .expect(201);
      
    return userData;
  };
  
  describe('Feature: User Registration', () => {
    it('Scenario: User signs up with valid credentials', async () => {
      // Given a new user with valid credentials
      const newUser = {
        email: 'signup-test@example.com',
        password: 'password123',
        nickname: 'SignUpTest'
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
    let testUser: { email: string; password: string; nickname: string };

    beforeEach(async () => {
      testUser = await createTestUser(1);
    });

    it('Scenario: User logs in and receives access and refresh tokens', async () => {
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
      
      // Then they should receive an access token
      expect(response.body.accessToken).toBeDefined();
      expect(typeof response.body.accessToken).toBe('string');
      
      // And they should receive a refresh token
      expect(response.body.refreshToken).toBeDefined();
      expect(typeof response.body.refreshToken).toBe('string');
      
      // And the tokens should be set as cookies
      const cookies = response.headers['set-cookie'] as unknown as string[];
      expect(cookies).toBeDefined();
      expect(cookies.some((cookie: string) => cookie.includes('jwt='))).toBe(true);
      expect(cookies.some((cookie: string) => cookie.includes('refresh_token='))).toBe(true);
    });
    
    it('Scenario: User uses JWT token to access protected resources', async () => {
      // Given an authenticated user with a valid token
      const loginResponse = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });
      
      const authToken = loginResponse.body.accessToken;
      
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
  
  describe('Feature: Refresh Token Mechanism', () => {
    let accessToken: string;
    let refreshToken: string;
    
    it('Scenario: User can refresh their access token using refresh token', async () => {
      // Create a new test user with unique email just for this test
      const uniqueTestUser = await createTestUser(999); // Use a higher number to avoid collisions
      
      // First do the login to get tokens for our unique user
      const loginResponse = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: uniqueTestUser.email,
          password: uniqueTestUser.password
        })
        .expect(201);
      
      // Store the original tokens
      const initialRefreshToken = loginResponse.body.refreshToken;
      const initialAccessToken = loginResponse.body.accessToken;
      
      // Allow some time to pass to ensure tokens will be different
      await new Promise(resolve => setTimeout(resolve, 1000)); 
      
      // Now use the refresh token to get a new access token
      const response = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', `refresh_token=${initialRefreshToken}`)
        .expect(201);
      
      // Then they should receive a new access token and refresh token
      expect(response.body.accessToken).toBeDefined();
      expect(typeof response.body.accessToken).toBe('string');
      expect(response.body.refreshToken).toBeDefined();
      expect(typeof response.body.refreshToken).toBe('string');
      
      // The tokens should be different because we waited a second
      expect(response.body.accessToken).not.toBe(initialAccessToken);
      expect(response.body.refreshToken).not.toBe(initialRefreshToken);
      
      // And the new access token should work for protected resources
      const protectedResponse = await request(app.getHttpServer())
        .get('/api/users/me')
        .set('Authorization', `Bearer ${response.body.accessToken}`)
        .expect(200);
      
      expect(protectedResponse.body.email).toBe(uniqueTestUser.email);
      
      // And the old refresh token should no longer work
      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', `refresh_token=${initialRefreshToken}`)
        .expect(401);
      
      accessToken = response.body.accessToken;
      refreshToken = response.body.refreshToken;
    });
    
    it('Scenario: Cannot refresh token without valid refresh token cookie', async () => {
      // Given an access token but no refresh token cookie
      
      // When trying to refresh
      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);
    });
    
    it('Scenario: Refresh token is invalidated on logout', async () => {
      // Create a user and tokens just for this test
      const logoutTestUser = await createTestUser(1000);
      
      // Login to get tokens
      const loginResponse = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: logoutTestUser.email,
          password: logoutTestUser.password
        })
        .expect(201);
      
      const logoutToken = loginResponse.body.accessToken;
      const logoutRefreshToken = loginResponse.body.refreshToken;
        
      // When they logout using the access token
      await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${logoutToken}`)
        .expect(200);
      
      // Then the refresh token should no longer work
      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', `refresh_token=${logoutRefreshToken}`)
        .expect(401);
    });
  });
  
  describe('Feature: Token Blacklisting', () => {
    let testUser: { email: string; password: string; nickname: string };

    beforeEach(async () => {
      testUser = await createTestUser(3);
    });

    it('Scenario: Blacklisted tokens are rejected', async () => {
      // Given a valid token that we will blacklist
      const loginResponse = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(201);
      
      const tokenToBlacklist = loginResponse.body.accessToken;
      
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
    let testUser: { email: string; password: string; nickname: string };

    beforeEach(async () => {
      testUser = await createTestUser(4);
    });

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

      const token = loginResponse.body.accessToken;
      
      // When accessing a protected resource with the cookie
      const response = await agent
        .set('Authorization', `Bearer ${token}`)
        .get('/api/users/me')
        .expect(200);
      
      // Then they should receive the protected resource
      expect(response.body).toBeDefined();
      expect(response.body.email).toBe(testUser.email);
    });
    
    it('Scenario: Cookies are cleared on logout', async () => {
      // Given an authenticated agent
      const agent = request.agent(app.getHttpServer());
      
      const loginResponse = await agent
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(201);
      const token = loginResponse.body.accessToken;
      
      // When they logout
      const logoutResponse = await agent
        .set('Authorization', `Bearer ${token}`)
        .post('/api/auth/logout')
        .expect(200);
      
      // Then the cookies should be cleared
      const cookies = logoutResponse.headers['set-cookie'] as unknown as string[];
      expect(cookies).toBeDefined();
      expect(cookies.some((cookie: string) => 
        cookie.includes('jwt=;') || 
        cookie.includes('Expires=Thu, 01 Jan 1970'))
      ).toBe(true);
      expect(cookies.some((cookie: string) => 
        cookie.includes('refresh_token=;') || 
        cookie.includes('Expires=Thu, 01 Jan 1970'))
      ).toBe(true);
      
      // And they should no longer be able to access protected resources
      await agent
        .get('/api/users/me')
        .expect(401);
    });
  });
  
  describe('Feature: Account Deletion', () => {
    let testUser: { email: string; password: string; nickname: string };

    beforeEach(async () => {
      testUser = await createTestUser(5);
    });

    it('Scenario: User can delete their account', async () => {
      // First login to get a token
      const loginResponse = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(201);
      
      const token = loginResponse.body.accessToken;
      
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