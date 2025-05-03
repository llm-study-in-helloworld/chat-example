import { EntityManager, MikroORM } from '@mikro-orm/core';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppTestModule } from '../app-test.module';
import { AccessTokensDict, TestUser, TestUserResponse } from '../types/test-user.type';

describe('RoomsController (e2e)', () => {
  let app: INestApplication;
  let em: EntityManager;
  let orm: MikroORM;
  
  // Test users data
  const testUsers: TestUser[] = [];
  const accessTokens: AccessTokensDict = {};
  
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
    
    // Create test users and save their tokens
    for (let i = 1; i <= 3; i++) {
      const userData = await createTestUser(i);
      testUsers.push(userData.user);
      accessTokens[`user${i}`] = userData.token;
    }
  });
  
  afterAll(async () => {
    await app.close();
    await orm.close();
  });
  
  // Helper function to create a test user
  const createTestUser = async (index: number): Promise<TestUserResponse> => {
    const uniqueId = `${index}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const userData = {
      email: `rooms-test-${uniqueId}@example.com`,
      password: 'password123',
      nickname: `RoomsTestUser${uniqueId}`
    };
    
    // Register user
    await request(app.getHttpServer())
      .post('/api/auth/signup')
      .send(userData)
      .expect(201);
      
    // Login to get token
    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email: userData.email,
        password: userData.password
      })
      .expect(201);
    
    return {
      user: {
        ...userData,
        id: loginResponse.body.user.id
      },
      token: loginResponse.body.accessToken
    };
  };
  
  describe('Feature: Room Management', () => {
    let createdRoomId: number;
    let directMessageRoomId: number;
    
    it('Scenario: User creates a group room', async () => {
      // Given a user wants to create a group room with other users
      const createRoomData = {
        name: 'Test Group Room',
        isGroup: true,
        userIds: [testUsers[1].id, testUsers[2].id]
      };
      
      // When they send a request to create the room
      const response = await request(app.getHttpServer())
        .post('/api/rooms')
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .send(createRoomData)
        .expect(201);
      
      // Then the room should be created successfully
      expect(response.body.id).toBeDefined();
      expect(response.body.name).toBe(createRoomData.name);
      expect(response.body.isGroup).toBe(true);
      expect(response.body.users).toHaveLength(3); // Creator + 2 other users
      
      createdRoomId = response.body.id;
    });
    
    it('Scenario: User creates a direct message room', async () => {
      // Given a user wants to create a direct message room with another user
      const createRoomData = {
        name: null, // DM rooms typically don't have names
        isGroup: false,
        userIds: [testUsers[2].id]
      };
      
      // When they send a request to create the room
      const response = await request(app.getHttpServer())
        .post('/api/rooms')
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .send(createRoomData)
        .expect(201);
      
      // Then the direct message room should be created successfully
      expect(response.body.id).toBeDefined();
      expect(response.body.isGroup).toBe(false);
      expect(response.body.users).toHaveLength(2); // Just the two participants
      
      directMessageRoomId = response.body.id;
    });
    
    it('Scenario: User gets list of their rooms', async () => {
      // Given a user who is part of rooms
      
      // When they request their rooms
      const response = await request(app.getHttpServer())
        .get('/api/rooms')
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .expect(200);
      
      // Then they should receive a list of rooms they belong to
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(2); // At least the 2 rooms we created
      
      // Verify the rooms contain expected data
      const groupRoom = response.body.find(room => room.id === createdRoomId);
      expect(groupRoom).toBeDefined();
      expect(groupRoom.isGroup).toBe(true);
      
      const dmRoom = response.body.find(room => room.id === directMessageRoomId);
      expect(dmRoom).toBeDefined();
      expect(dmRoom.isGroup).toBe(false);
    });
    
    it('Scenario: User retrieves a specific room', async () => {
      // Given a room ID
      
      // When the user requests that specific room
      const response = await request(app.getHttpServer())
        .get(`/api/rooms/${createdRoomId}`)
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .expect(200);
      
      // Then they should receive the room details
      expect(response.body.id).toBe(createdRoomId);
      expect(response.body.users).toBeDefined();
      expect(Array.isArray(response.body.users)).toBe(true);
    });
    
    it('Scenario: User cannot access a room they are not part of', async () => {
      // Create a new user who is not part of any rooms
      const outsiderUser = await createTestUser(99);
      
      // When they try to access a room they're not part of
      await request(app.getHttpServer())
        .get(`/api/rooms/${createdRoomId}`)
        .set('Authorization', `Bearer ${outsiderUser.token}`)
        .expect(403); // Forbidden
    });
    
    it('Scenario: User adds another user to a group room', async () => {
      // Create a new user to add to the group
      const newUser = await createTestUser(4);
      
      // Given the user wants to add a new member to the group
      const addUserData = {
        userId: newUser.user.id
      };
      
      // When they send the request to add the user
      await request(app.getHttpServer())
        .post(`/api/rooms/${createdRoomId}/users`)
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .send(addUserData)
        .expect(201);
      
      // Then the new user should now be able to access the room
      const response = await request(app.getHttpServer())
        .get(`/api/rooms/${createdRoomId}`)
        .set('Authorization', `Bearer ${newUser.token}`)
        .expect(200);
      
      expect(response.body.id).toBe(createdRoomId);
    });
    
    it('Scenario: Cannot add users to a direct message room', async () => {
      // Create a new user to try to add to the DM
      const newUser = await createTestUser(5);
      
      // Given a user tries to add someone to a DM
      const addUserData = {
        userId: newUser.user.id
      };
      
      // When they send the request
      await request(app.getHttpServer())
        .post(`/api/rooms/${directMessageRoomId}/users`)
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .send(addUserData)
        .expect(403); // Forbidden
    });
    
    it('Scenario: User leaves a room', async () => {
      // Given user2 wants to leave the group room
      
      // When they send the request to remove themselves
      await request(app.getHttpServer())
        .delete(`/api/rooms/${createdRoomId}/users/${testUsers[1].id}`)
        .set('Authorization', `Bearer ${accessTokens['user2']}`)
        .expect(200);
      
      // Then they should no longer have access to the room
      await request(app.getHttpServer())
        .get(`/api/rooms/${createdRoomId}`)
        .set('Authorization', `Bearer ${accessTokens['user2']}`)
        .expect(403); // Forbidden
    });
    
    it('Scenario: User cannot remove other users from a room', async () => {
      // Given user1 tries to remove user3 from the group
      
      // When they send the request
      await request(app.getHttpServer())
        .delete(`/api/rooms/${createdRoomId}/users/${testUsers[2].id}`)
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .expect(403); // Forbidden
    });
    
    it('Scenario: User updates their last seen timestamp', async () => {
      // Given user1 wants to mark a room as seen
      
      // When they send the request
      await request(app.getHttpServer())
        .post(`/api/rooms/${createdRoomId}/seen`)
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .expect(201);
      
      // Success is validated by the 201 response
    });
  });
}); 