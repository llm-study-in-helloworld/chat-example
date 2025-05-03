import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TestUser, TestUserResponse } from '../types/test-user.type';

/**
 * Helper class for managing test users in e2e tests
 */
export class TestUserHelper {
  private readonly app: INestApplication;
  private readonly basePassword: string;
  private readonly prefix: string;
  
  /**
   * Creates a new TestUserHelper
   * 
   * @param app NestJS application instance
   * @param options Configuration options
   */
  constructor(
    app: INestApplication,
    options: {
      basePassword?: string;
      prefix?: string;
    } = {}
  ) {
    this.app = app;
    this.basePassword = options.basePassword || 'password123';
    this.prefix = options.prefix || '';
  }
  
  /**
   * Creates a test user with unique identifiers
   * 
   * @param index Unique index for the user
   * @returns User data and auth token
   */
  async createTestUser(index: number): Promise<TestUserResponse> {
    // Add a random string to ensure uniqueness
    const uniqueId = `${this.prefix}${index}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const userData = {
      email: `test-${uniqueId}@example.com`,
      password: this.basePassword,
      nickname: `TestUser${uniqueId}`
    };
    
    const response = await request(this.app.getHttpServer())
      .post('/api/auth/signup')
      .send(userData)
      .expect(201);
      
    // Login to get the token
    const loginResponse = await request(this.app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: userData.email,
        password: userData.password
      })
      .expect(201);
    
    const user: TestUser = {
      id: response.body.id,
      email: userData.email,
      password: userData.password,
      nickname: userData.nickname
    };
    
    return {
      user,
      token: loginResponse.body.accessToken,
      refreshToken: loginResponse.body.refreshToken
    };
  }
  
  /**
   * Creates multiple test users with unique identifiers
   * 
   * @param count Number of users to create
   * @param startIndex Starting index for the first user
   * @returns Array of user data and auth tokens
   */
  async createTestUsers(count: number, startIndex: number = 1): Promise<TestUserResponse[]> {
    const users: TestUserResponse[] = [];
    
    for (let i = 0; i < count; i++) {
      users.push(await this.createTestUser(startIndex + i));
    }
    
    return users;
  }
  
  /**
   * Authenticates with an existing user
   * 
   * @param user Existing test user
   * @returns Auth token
   */
  async loginTestUser(user: TestUser): Promise<string> {
    const loginResponse = await request(this.app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: user.email,
        password: user.password
      })
      .expect(201);
    
    return loginResponse.body.accessToken;
  }
} 