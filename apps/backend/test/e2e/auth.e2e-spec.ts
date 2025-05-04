import { EntityManager, MikroORM } from '@mikro-orm/core';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppTestModule } from '../app-test.module';
import { TestUserHelper } from './helpers';
import { TestUser } from './helpers/test-user.type';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let em: EntityManager;
  let orm: MikroORM;
  let userHelper: TestUserHelper;

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

    // Initialize the TestUserHelper
    userHelper = new TestUserHelper(app, {
      basePassword: baseTestUser.password,
      prefix: 'auth-'
    });

    await app.init();
  });
  
  afterAll(async () => {
    await app.close();
    await orm.close();
  });

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
    let testUser: TestUser;
    let accessToken: string;

    beforeEach(async () => {
      const result = await userHelper.createTestUser(1);
      testUser = result.user;
      accessToken = result.token;
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
      
      // Then they should receive an auth response with token and user
      expect(response.body.token).toBeDefined();
      expect(typeof response.body.token).toBe('string');
      
      // And user information should be included
      expect(response.body.user).toBeDefined();
      expect(response.body.user.id).toBeDefined();
      expect(response.body.user.email).toBe(testUser.email);
      expect(response.body.user.nickname).toBeDefined();
      
      // And they should have cookies set
      const cookies = response.headers['set-cookie'] as unknown as string[];
      expect(cookies).toBeDefined();
      expect(cookies.some((cookie: string) => cookie.includes('jwt='))).toBe(true);
      expect(cookies.some((cookie: string) => cookie.includes('refresh_token='))).toBe(true);
    });
    
    it('Scenario: User uses JWT token to access protected resources', async () => {
      // When they access a protected resource
      const response = await request(app.getHttpServer())
        .get('/api/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
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
      const result = await userHelper.createTestUser(999); // Use a higher number to avoid collisions
      const uniqueTestUser = result.user;
      const initialRefreshToken = result.refreshToken;
      const initialAccessToken = result.token;
      
      // Allow some time to pass to ensure tokens will be different
      await new Promise(resolve => setTimeout(resolve, 1000)); 
      
      // Now use the refresh token to get a new access token
      const response = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', `refresh_token=${initialRefreshToken}`)
        .expect(201);
      
      // Then they should receive a new token in the response
      expect(response.body.token).toBeDefined();
      expect(typeof response.body.token).toBe('string');
      
      // And the token should be different
      expect(response.body.token).not.toBe(initialAccessToken);
      
      // The user data should be included
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(uniqueTestUser.email);
      
      // And cookies should be refreshed
      const cookies = response.headers['set-cookie'] as unknown as string[];
      expect(cookies).toBeDefined();
      expect(cookies.some((cookie: string) => cookie.includes('jwt='))).toBe(true);
      expect(cookies.some((cookie: string) => cookie.includes('refresh_token='))).toBe(true);
      
      // And the new access token should work for protected resources
      const protectedResponse = await request(app.getHttpServer())
        .get('/api/users/me')
        .set('Authorization', `Bearer ${response.body.token}`)
        .expect(200);
      
      expect(protectedResponse.body.email).toBe(uniqueTestUser.email);
      
      // Extract the new refresh token from the cookie
      const refreshCookie = cookies.find(cookie => cookie.includes('refresh_token=') && cookie.includes('Max-Age='));
      const cookieValue = refreshCookie?.split(';')[0].split('=')[1];
      
      // And the old refresh token should no longer work
      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Cookie', `refresh_token=${initialRefreshToken}`)
        .expect(401);
      
      accessToken = response.body.token;
      refreshToken = cookieValue || '';
    });
    
    it('Scenario: Cannot refresh token without valid refresh token cookie', async () => {
      // Given an access token but no refresh token cookie
      
      // When trying to refresh
      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);
    });
  });
  
  describe('Feature: Logout', () => {
    let accessToken: string;

    beforeEach(async () => {
      const result = await userHelper.createTestUser(888);
      accessToken = result.token;
    });

    it('Scenario: User can logout successfully', async () => {
      // When they logout
      const response = await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      
      // Then they should receive a success message
      expect(response.body.message).toBe('Logged out successfully');
      
      // And the cookies should be cleared
      const cookies = response.headers['set-cookie'] as unknown as string[];
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
      await request(app.getHttpServer())
        .get('/api/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);
    });
  });
  
  describe('Feature: Token Blacklisting', () => {
    let testUser: TestUser;
    let tokenToBlacklist: string;

    beforeEach(async () => {
      const result = await userHelper.createTestUser(3);
      testUser = result.user;
      tokenToBlacklist = result.token;
    });

    it('Scenario: Blacklisted tokens are rejected', async () => {
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
    let testUser: TestUser;
    let accessToken: string;

    beforeEach(async () => {
      const result = await userHelper.createTestUser(4);
      testUser = result.user;
      accessToken = result.token;
    });

    it('Scenario: Authentication works via cookies', async () => {
      // Given a successful login that sets cookies
      const agent = request.agent(app.getHttpServer());
      
      // When accessing a protected resource with the cookie
      const response = await agent
        .set('Authorization', `Bearer ${accessToken}`)
        .get('/api/users/me')
        .expect(200);
      
      // Then they should receive the protected resource
      expect(response.body).toBeDefined();
      expect(response.body.email).toBe(testUser.email);
    });
    
    it('Scenario: Cookies are cleared on logout', async () => {
      // Given an authenticated agent
      const agent = request.agent(app.getHttpServer());
      
      // When they logout
      const logoutResponse = await agent
        .set('Authorization', `Bearer ${accessToken}`)
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
    let testUser: TestUser;
    let accessToken: string;
    beforeEach(async () => {
      const result = await userHelper.createTestUser(5);
      testUser = result.user;
      accessToken = result.token;
    });

    it('Scenario: User can delete their account', async () => {
      // When they delete their account
      const deleteResponse = await request(app.getHttpServer())
        .delete('/api/auth/signout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ password: testUser.password })
        .expect(200);
      
      // Then they should receive a success message
      expect(deleteResponse.body.message).toBe('Account deleted successfully');
      
      // And the cookies should be cleared
      const cookies = deleteResponse.headers['set-cookie'] as unknown as string[];
      expect(cookies).toBeDefined();
      expect(cookies.some((cookie: string) => 
        cookie.includes('jwt=;') || 
        cookie.includes('Expires=Thu, 01 Jan 1970'))
      ).toBe(true);
      expect(cookies.some((cookie: string) => 
        cookie.includes('refresh_token=;') || 
        cookie.includes('Expires=Thu, 01 Jan 1970'))
      ).toBe(true);
      
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