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
  let orm: MikroORM;
  
  // Base test user data
  const baseTestUser = {
    password: 'password123',
  };

  // For password change test
  const newPassword = 'newPassword123';
  
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

  // Helper function to create a test user with unique identifiers
  const createTestUser = async (index: number) => {
    // Add a random string to ensure uniqueness
    const uniqueId = `${index}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const userData = {
      email: `test-${uniqueId}@example.com`,
      password: baseTestUser.password,
      nickname: `TestUser${uniqueId}`
    };
    
    const response = await request(app.getHttpServer())
      .post('/api/auth/signup')
      .send(userData)
      .expect(201);
      
    return {
      userData,
      userId: response.body.id
    };
  };
  
  // ATDD style - Acceptance criteria grouped by features
  describe('Feature: User Registration', () => {
    let testUser;
    
    beforeAll(async () => {
      testUser = (await createTestUser(1)).userData;
    });
    
    it('Scenario: User signs up with valid credentials', async () => {
      // Given a user with valid credentials
      const userData = {
        email: `new-${Date.now()}@example.com`,
        password: baseTestUser.password,
        nickname: `NewUser${Date.now()}`
      };
      
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
    });
    
    it('Scenario: User tries to sign up with existing email', async () => {
      // Given a user with an email that already exists
      
      // When they try to sign up
      const response = await request(app.getHttpServer())
        .post('/api/auth/signup')
        .send(testUser)
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
  
  describe('Feature: User Profile Management', () => {
    let testUser;
    let authToken;
    
    beforeEach(async () => {
      const result = await createTestUser(2);
      testUser = result.userData;
      
      // Login to get token
      const loginResponse = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(201);
        
      authToken = loginResponse.body.accessToken;
    });
    
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
        newPassword: newPassword
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
          password: newPassword
        })
        .expect(201);
      
      expect(loginResponse.body.accessToken).toBeDefined();
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
    let testUser;
    let authToken;
    
    beforeAll(async () => {
      const result = await createTestUser(3);
      testUser = result.userData;
      
      // Login to get token
      const loginResponse = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(201);
        
      authToken = loginResponse.body.accessToken;
    });
    
    it('Scenario: User logs out successfully', async () => {
      // When they log out
      const response = await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      // Then they should receive a success message
      expect(response.body.message).toContain('success');
      
      // And the cookie should be cleared
      const cookies = response.headers['set-cookie'] as unknown as string[];
      expect(cookies).toBeDefined();
      expect(cookies.some((cookie: string) => 
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
    let testUser;
    let authToken;
    
    beforeEach(async () => {
      const result = await createTestUser(4);
      testUser = result.userData;
      
      // Login to get token
      const loginResponse = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(201);
        
      authToken = loginResponse.body.accessToken;
    });
    
    it('Scenario: User deletes their account with valid password', async () => {
      // When they delete their account
      const response = await request(app.getHttpServer())
        .delete('/api/auth/signout')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ password: testUser.password })
        .expect(200);
      
      // Then they should receive a success message
      expect(response.body.message).toContain('success');
      
      // And the cookie should be cleared
      const cookies = response.headers['set-cookie'] as unknown as string[];
      expect(cookies).toBeDefined();
      expect(cookies.some((cookie: string) => 
        cookie.includes('jwt=;') || 
        cookie.includes('Expires=Thu, 01 Jan 1970'))
      ).toBe(true);
      
      // And their account should no longer exist
      const user = await em.findOne(User, { email: testUser.email });
      expect(user).toBeNull();
    });
    
    it('Scenario: Deleted user tries to log in', async () => {
      // First delete the account
      await request(app.getHttpServer())
        .delete('/api/auth/signout')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ password: testUser.password })
        .expect(200);
        
      // When the deleted user tries to log in
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