import { RoomRole } from '@chat-example/types';
import { EntityManager, MikroORM } from '@mikro-orm/core';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { LoggerService } from '../../src/logger/logger.service';
import { AppTestModule } from '../app-test.module';
import { TestUserHelper } from './helpers';
import { mockLoggerService } from './helpers/logger-mock';
import { AccessTokensDict, TestUser } from './helpers/test-user.type';

describe('RoomsController (e2e)', () => {
  let app: INestApplication;
  let em: EntityManager;
  let orm: MikroORM;
  let userHelper: TestUserHelper;
  
  // Test users data
  const testUsers: TestUser[] = [];
  const accessTokens: AccessTokensDict = {};
  
  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppTestModule],
    })
    .overrideProvider(LoggerService)
    .useValue(mockLoggerService)
    .compile();

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
    
    // Initialize the TestUserHelper
    userHelper = new TestUserHelper(app, {
      prefix: 'rooms-'
    });
    
    await app.init();
    
    // Create test users and save their tokens
    for (let i = 1; i <= 3; i++) {
      const userData = await userHelper.createTestUser(i);
      testUsers.push(userData.user);
      accessTokens[`user${i}`] = userData.token;
    }
  });
  
  afterAll(async () => {
    await app.close();
    await orm.close();
  });
  
  describe('Feature: Room Management', () => {
    let createdRoomId: number;
    let directMessageRoomId: number;
    
    it('Scenario: User creates a group room', async () => {
      // Given a user wants to create a group room with other users
      const createRoomData = {
        name: 'Test Group Room',
        isDirect: false,
        isPrivate: false,
        isActive: true,
        userIds: [testUsers[1].id, testUsers[2].id],
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
      expect(response.body.isDirect).toBe(false);
      
      createdRoomId = response.body.id;
    });
    
    it('Scenario: User creates a direct message room', async () => {
      // Given a user wants to create a direct message room with another user
      const createRoomData = {
        name: '', // DM rooms typically don't have names
        isDirect: true,
        isPrivate: false,
        isActive: true,
        userIds: [testUsers[2].id]
      };
      
      // When they send the request to create the room
      const response = await request(app.getHttpServer())
        .post('/api/rooms')
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .send(createRoomData)
        .expect(201);
      
      // Then the direct message room should be created successfully
      expect(response.body.id).toBeDefined();
      expect(response.body.isDirect).toBe(true);
      
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
      const groupRoom = response.body.find((room: any) => room.id === createdRoomId);
      expect(groupRoom).toBeDefined();
      expect(groupRoom.isDirect).toBe(false);
      
      const dmRoom = response.body.find((room: any) => room.id === directMessageRoomId);
      expect(dmRoom).toBeDefined();
      expect(dmRoom.isDirect).toBe(true);
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
      expect(response.body.name).toBe('Test Group Room');
    });
    
    it('Scenario: User cannot access a room they are not part of', async () => {
      // Create a new user who is not part of any rooms
      const outsiderUser = await userHelper.createTestUser(99);
      
      // When they try to access a room they're not part of
      await request(app.getHttpServer())
        .get(`/api/rooms/${createdRoomId}`)
        .set('Authorization', `Bearer ${outsiderUser.token}`)
        .expect(403); // Forbidden
    });
    
    it('Scenario: User adds another user to a group room', async () => {
      // Create a new user to add to the group
      const newUser = await userHelper.createTestUser(4);
      
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
    
    it('Scenario: User removes another user from a group room', async () => {
      // First, add a user to the room who we'll then remove
      const userToRemove = await userHelper.createTestUser(5);
      
      await request(app.getHttpServer())
        .post(`/api/rooms/${createdRoomId}/users`)
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .send({ userId: userToRemove.user.id })
        .expect(201);
      
      // When they remove the user
      await request(app.getHttpServer())
        .delete(`/api/rooms/${createdRoomId}/users/${userToRemove.user.id}`)
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .expect(200);
      
      // Then the removed user should no longer be able to access the room
      await request(app.getHttpServer())
        .get(`/api/rooms/${createdRoomId}`)
        .set('Authorization', `Bearer ${userToRemove.token}`)
        .expect(403); // Forbidden
    });
    
    it('Scenario: User updates a room', async () => {
      // Given updated room data
      const updateData = {
        name: 'Updated Room Name',
        isPrivate: true
      };
      
      // When they update the room
      const response = await request(app.getHttpServer())
        .patch(`/api/rooms/${createdRoomId}`)
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .send(updateData)
        .expect(200);
      
      // Then the room should be updated
      expect(response.body.name).toBe(updateData.name);
      expect(response.body.isPrivate).toBe(updateData.isPrivate);
      
      // Verify the changes were persisted
      const verifyResponse = await request(app.getHttpServer())
        .get(`/api/rooms/${createdRoomId}`)
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .expect(200);
      
      expect(verifyResponse.body.name).toBe(updateData.name);
      expect(verifyResponse.body.isPrivate).toBe(updateData.isPrivate);
    });
    
    it('Scenario: Non-admin user cannot update a room', async () => {
      // Given a non-admin user is part of a room
      
      // When they try to update the room
      await request(app.getHttpServer())
        .patch(`/api/rooms/${createdRoomId}`)
        .set('Authorization', `Bearer ${accessTokens['user2']}`)
        .send({ name: 'Unauthorized Change' })
        .expect(403); // Forbidden
    });
    
    it('Scenario: User leaves a room', async () => {
      // Create a new room 
      const roomResponse = await request(app.getHttpServer())
        .post('/api/rooms')
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .send({
          name: 'Room to Leave',
          isDirect: false,
          isPrivate: false,
          userIds: [testUsers[1].id, testUsers[2].id]
        })
        .expect(201);
      
      const roomToLeaveId = roomResponse.body.id;
      
      // When user2 leaves the room
      await request(app.getHttpServer())
        .delete(`/api/rooms/${roomToLeaveId}/leave`)
        .set('Authorization', `Bearer ${accessTokens['user2']}`)
        .expect(200);
      
      // Then they should no longer have access to the room
      await request(app.getHttpServer())
        .get(`/api/rooms/${roomToLeaveId}`)
        .set('Authorization', `Bearer ${accessTokens['user2']}`)
        .expect(403);
      
      // But the room should still exist for other users
      await request(app.getHttpServer())
        .get(`/api/rooms/${roomToLeaveId}`)
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .expect(200);
    });
  });
  
  describe('Feature: Room Membership', () => {
    let groupRoomId: number;
    
    beforeEach(async () => {
      // Create a new group room for testing membership features
      const roomResponse = await request(app.getHttpServer())
        .post('/api/rooms')
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .send({
          name: `Membership Test Room ${Date.now()}`,
          isDirect: false,
          isPrivate: false,
          userIds: []
        })
        .expect(201);
      
      groupRoomId = roomResponse.body.id;
    });
    
    it('Scenario: User gets list of room members', async () => {
      // Add a few users to the room
      for (let i = 2; i <= 3; i++) {
        await request(app.getHttpServer())
          .post(`/api/rooms/${groupRoomId}/users`)
          .set('Authorization', `Bearer ${accessTokens['user1']}`)
          .send({ userId: testUsers[i-1].id })
          .expect(201);
      }
      
      // When user gets room members
      const response = await request(app.getHttpServer())
        .get(`/api/rooms/${groupRoomId}/users`)
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .expect(200);
      
      // Then they should see all members
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(3); // Creator + 2 added users
      
      // Check that each test user is in the members list
      for (let i = 0; i < 3; i++) {
        const userFound = response.body.some((member: any) => member.user.id === testUsers[i].id);
        expect(userFound).toBe(true);
      }
    });
    
    it('Scenario: Room creator has admin role', async () => {
      // When they get room members
      const response = await request(app.getHttpServer())
        .get(`/api/rooms/${groupRoomId}/users`)
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .expect(200);
      
      // Then the creator should have admin role
      const adminUser = response.body.find((member: any) => member.user.id === testUsers[0].id);
      expect(adminUser).toBeDefined();
      expect(adminUser.role).toBe(RoomRole.OWNER);
    });
    
    it('Scenario: Added members have member role by default', async () => {
      // Add a user to the room
      await request(app.getHttpServer())
        .post(`/api/rooms/${groupRoomId}/users`)
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .send({ userId: testUsers[1].id })
        .expect(201);
      
      // When they get room members
      const response = await request(app.getHttpServer())
        .get(`/api/rooms/${groupRoomId}/users`)
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .expect(200);
      
      // Then the added user should have member role
      const memberUser = response.body.find((member: any) => member.user.id === testUsers[1].id);
      expect(memberUser).toBeDefined();
      expect(memberUser.role).toBe(RoomRole.MEMBER);
    });
    
    it('Scenario: Admin can promote a member to admin', async () => {
      // First add a member
      await request(app.getHttpServer())
        .post(`/api/rooms/${groupRoomId}/users`)
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .send({ userId: testUsers[1].id })
        .expect(201);
      
      // When admin promotes the member
      await request(app.getHttpServer())
        .patch(`/api/rooms/${groupRoomId}/users/${testUsers[1].id}/role`)
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .send({ role: RoomRole.ADMIN })
        .expect(200);
      
      // Then the user should have admin role
      const response = await request(app.getHttpServer())
        .get(`/api/rooms/${groupRoomId}/users`)
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .expect(200);
      
      const promotedUser = response.body.find((member: any) => member.user.id === testUsers[1].id);
      expect(promotedUser).toBeDefined();
      expect(promotedUser.role).toBe(RoomRole.ADMIN);
    });
    
    it('Scenario: Non-admin cannot promote members', async () => {
      // First add two members
      for (let i = 2; i <= 3; i++) {
        await request(app.getHttpServer())
          .post(`/api/rooms/${groupRoomId}/users`)
          .set('Authorization', `Bearer ${accessTokens['user1']}`)
          .send({ userId: testUsers[i-1].id })
          .expect(201);
      }
      
      // When non-admin tries to promote another member
      await request(app.getHttpServer())
        .patch(`/api/rooms/${groupRoomId}/users/${testUsers[2].id}/role`)
        .set('Authorization', `Bearer ${accessTokens['user2']}`)
        .send({ role: RoomRole.ADMIN })
        .expect(403); // Forbidden
    });
  });
  
  describe('Feature: Direct Messaging', () => {
    it('Scenario: Creating a direct message room with an existing user', async () => {
      // Given data for creating a direct message room
      const dmData = {
        isDirect: true,
        userIds: [testUsers[0].id]
      };
      
      // When user creates the DM room
      const response = await request(app.getHttpServer())
        .post('/api/rooms')
        .set('Authorization', `Bearer ${accessTokens['user2']}`)
        .send(dmData)
        .expect(201);
      
      // Then the DM room should be created
      expect(response.body.id).toBeDefined();
      expect(response.body.isDirect).toBe(true);
      
      // Check that both users can access the room
      await request(app.getHttpServer())
        .get(`/api/rooms/${response.body.id}`)
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .expect(200);
        
      await request(app.getHttpServer())
        .get(`/api/rooms/${response.body.id}`)
        .set('Authorization', `Bearer ${accessTokens['user2']}`)
        .expect(200);
    });
    
    it('Scenario: Creating a DM room with a user already in a DM returns the existing room', async () => {
      // First, create a DM room between user1 and user2
      const firstResponse = await request(app.getHttpServer())
        .post('/api/rooms')
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .send({
          isDirect: true,
          userIds: [testUsers[1].id]
        })
        .expect(201);
      
      const firstRoomId = firstResponse.body.id;
      
      // When creating another DM with the same users
      const secondResponse = await request(app.getHttpServer())
        .post('/api/rooms')
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .send({
          isDirect: true,
          userIds: [testUsers[1].id]
        })
        .expect(201);
      
      // Then it should return the existing room
      expect(secondResponse.body.id).toBe(firstRoomId);
    });
    
    it('Scenario: DM rooms show correct other user details', async () => {
      // Create a DM room
      const response = await request(app.getHttpServer())
        .post('/api/rooms')
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .send({
          isDirect: true,
          userIds: [testUsers[1].id]
        })
        .expect(201);
      
      const dmRoomId = response.body.id;
      
      // Get user's rooms
      const roomsResponse = await request(app.getHttpServer())
        .get('/api/rooms')
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .expect(200);
      
      // Find the DM room
      const dmRoom = roomsResponse.body.find((room: any) => room.id === dmRoomId);
      expect(dmRoom).toBeDefined();
      
      // Check that otherUser points to user2
      expect(dmRoom.otherUser).toBeDefined();
      expect(dmRoom.otherUser.id).toBe(testUsers[1].id);
      
      // Check from user2's perspective
      const user2RoomsResponse = await request(app.getHttpServer())
        .get('/api/rooms')
        .set('Authorization', `Bearer ${accessTokens['user2']}`)
        .expect(200);
      
      const dmRoomForUser2 = user2RoomsResponse.body.find((room: any) => room.id === dmRoomId);
      expect(dmRoomForUser2).toBeDefined();
      expect(dmRoomForUser2.otherUser).toBeDefined();
      expect(dmRoomForUser2.otherUser.id).toBe(testUsers[0].id);
    });
    
    it('Scenario: DM rooms cannot have additional users added', async () => {
      // Create a DM room
      const response = await request(app.getHttpServer())
        .post('/api/rooms')
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .send({
          isDirect: true,
          userIds: [testUsers[1].id]
        })
        .expect(201);
      
      const dmRoomId = response.body.id;
      
      // Try to add a third user
      await request(app.getHttpServer())
        .post(`/api/rooms/${dmRoomId}/users`)
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .send({ userId: testUsers[2].id })
        .expect(400); // Bad Request
    });
  });
});