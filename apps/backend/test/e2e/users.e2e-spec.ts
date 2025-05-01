import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { EntityManager, MikroORM } from '@mikro-orm/core';
import { User } from '../../src/entities';
import bcrypt from 'bcrypt';
import { AppTestModule } from '../app-test.module';
import testConfig from '../mikro-orm.config.test';

describe('UsersController (e2e)', () => {
  let app: INestApplication;
  let em: EntityManager;
  let authToken: string;
  let userId: number;
  let orm: MikroORM;
  
  // Test user data
  const testUser = {
    email: 'test@example.com',
    password: 'password123',
    nickname: 'TestUser'
  };
  
  const testUserUpdate = {
    nickname: 'UpdatedUser',
    imageUrl: 'https://example.com/image.jpg'
  };
  
  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppTestModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    em = app.get<EntityManager>(EntityManager);
    orm = app.get<MikroORM>(MikroORM);
    
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
    await app.close();
    await orm.close();
  });
  
  // ATDD style - Acceptance criteria grouped by features
  describe('Feature: User Registration', () => {
    it('Scenario: User signs up with valid credentials', async () => {
      // Given a user with valid credentials
      const userData = { ...testUser };
      
      // When they sign up
      const response = await request(app.getHttpServer())
        .post('/api/auth/signup')
        .send(userData)
        .expect(201);
      
      // Then they should receive a successful response with user data
      expect(response.body).toBeDefined();
      expect(response.body.id).toBeDefined();
      expect(response.body.email).toBe(userData.email);
      expect(response.body.nickname).toBe(userData.nickname);
      
      // Save userId for later tests
      userId = response.body.id;
    });
    
    it('Scenario: User tries to sign up with existing email', async () => {
      // Given a user with an email that already exists
      const userData = { ...testUser };
      
      // When they try to sign up
      const response = await request(app.getHttpServer())
        .post('/api/auth/signup')
        .send(userData)
        .expect(409); // Conflict
      
      // Then they should receive an error
      expect(response.body.message).toContain('already exists');
    });
    
    it('Scenario: User tries to sign up with invalid data', async () => {
      // Given invalid user data (missing required fields)
      const invalidUser = {
        email: 'invalid@example.com'
        // Missing password and nickname
      };
      
      // When they try to sign up
      const response = await request(app.getHttpServer())
        .post('/api/auth/signup')
        .send(invalidUser)
        .expect(400); // Bad Request
      
      // Then they should receive validation errors
      expect(response.body.message).toBeInstanceOf(Array);
    });
  });
  
  describe('Feature: User Authentication', () => {
    it('Scenario: User logs in with valid credentials', async () => {
      // Given a registered user with valid credentials
      const loginData = {
        email: testUser.email,
        password: testUser.password
      };
      
      // When they log in
      const response = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send(loginData)
        .expect(201);
      
      // Then they should receive an auth token and user data
      expect(response.body.token).toBeDefined();
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(testUser.email);
      
      // Check for JWT cookie
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.split(';').some((cookie: string) => cookie.includes('jwt='))).toBe(true);
      
      // Save token for later tests
      authToken = response.body.token;
    });
    
    it('Scenario: User tries to log in with invalid credentials', async () => {
      // Given invalid login credentials
      const invalidLogin = {
        email: testUser.email,
        password: 'wrongpassword'
      };
      
      // When they try to log in
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send(invalidLogin)
        .expect(401); // Unauthorized
    });
    
    it('Scenario: User accesses protected endpoint with valid token', async () => {
      // Given an authenticated user
      
      // When they access a protected endpoint
      const response = await request(app.getHttpServer())
        .get('/api/users/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      // Then they should receive their user data
      expect(response.body).toBeDefined();
      expect(response.body.email).toBe(testUser.email);
    });
    
    it('Scenario: User tries to access protected endpoint without token', async () => {
      // Given an unauthenticated request
      
      // When they try to access a protected endpoint
      await request(app.getHttpServer())
        .get('/api/users/me')
        .expect(401); // Unauthorized
    });
  });
  
  describe('Feature: User Profile Management', () => {
    it('Scenario: User updates their profile', async () => {
      // Given an authenticated user and update data
      
      // When they update their profile
      const response = await request(app.getHttpServer())
        .patch('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testUserUpdate)
        .expect(200);
      
      // Then their profile should be updated
      expect(response.body).toBeDefined();
      expect(response.body.nickname).toBe(testUserUpdate.nickname);
      expect(response.body.imageUrl).toBe(testUserUpdate.imageUrl);
    });
    
    it('Scenario: User changes their password', async () => {
      // Given an authenticated user and password change data
      const passwordChange = {
        nickname: testUserUpdate.nickname, // Required field
        currentPassword: testUser.password,
        newPassword: 'newPassword123'
      };
      
      // When they change their password
      await request(app.getHttpServer())
        .patch('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(passwordChange)
        .expect(200);
      
      // Then they should be able to log in with the new password
      const loginResponse = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'newPassword123'
        })
        .expect(201);
      
      expect(loginResponse.body.token).toBeDefined();
      
      // Update authToken for remaining tests
      authToken = loginResponse.body.token;
    });
    
    it('Scenario: User tries to change password with incorrect current password', async () => {
      // Given incorrect current password
      const incorrectPasswordChange = {
        nickname: testUserUpdate.nickname, // Required field
        currentPassword: 'wrongPassword',
        newPassword: 'anotherPassword123'
      };
      
      // When they try to change their password
      await request(app.getHttpServer())
        .patch('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(incorrectPasswordChange)
        .expect(401); // Unauthorized
    });
  });
  
  describe('Feature: User Logout', () => {
    it('Scenario: User logs out successfully', async () => {
      // Given an authenticated user
      
      // When they log out
      const response = await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      // Then they should receive a success message
      expect(response.body.message).toContain('success');
      
      // And the cookie should be cleared
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.split(';').some((cookie: string) => 
        cookie.includes('jwt=;') || 
        cookie.includes('Expires=Thu, 01 Jan 1970'))
      ).toBe(true);
      
      // And their token should be invalidated (they can't access protected endpoints)
      await request(app.getHttpServer())
        .get('/api/users/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(401);
    });
  });
  
  describe('Feature: Account Deletion', () => {
    // First login to get a new token
    beforeAll(async () => {
      // Update test user password first
      const user = await em.findOne(User, { email: testUser.email });
      if (user) {
        // Hash the password
        const saltRounds = 10;
        user.passwordHash = await bcrypt.hash('newPassword123', saltRounds);
        await em.flush();
      }
      
      const loginResponse = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'newPassword123'
        });
      
      authToken = loginResponse.body.token;
    });
    
    it('Scenario: User deletes their account with valid password', async () => {
      // Given an authenticated user with correct password
      const deleteData = {
        password: 'newPassword123'
      };
      
      // When they delete their account
      const response = await request(app.getHttpServer())
        .delete('/api/auth/signout')
        .set('Authorization', `Bearer ${authToken}`)
        .send(deleteData)
        .expect(200);
      
      // Then they should receive a success message
      expect(response.body.message).toContain('success');
      
      // And the cookie should be cleared
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.split(';').some((cookie: string) => 
        cookie.includes('jwt=;') || 
        cookie.includes('Expires=Thu, 01 Jan 1970'))
      ).toBe(true);
      
      // And their account should no longer exist
      const user = await em.findOne(User, { email: testUser.email });
      expect(user).toBeNull();
    });
    
    it('Scenario: Deleted user tries to log in', async () => {
      // Given a deleted user's credentials
      const loginData = {
        email: testUser.email,
        password: 'newPassword123'
      };
      
      // When they try to log in
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send(loginData)
        .expect(401); // Unauthorized
    });
  });
}); 