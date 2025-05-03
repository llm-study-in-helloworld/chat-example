import { EntityManager, MikroORM } from '@mikro-orm/core';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { CreateRoomRequestDto } from '../../src/rooms/dto';
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
      const createRoomData: CreateRoomRequestDto = {
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
      const groupRoom = response.body.find(room => room.id === createdRoomId);
      expect(groupRoom).toBeDefined();
      expect(groupRoom.isDirect).toBe(false);
      
      const dmRoom = response.body.find(room => room.id === directMessageRoomId);
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

    it('Scenario: User updates room information', async () => {
      // Given user1 wants to update room information
      const updateRoomData = {
        name: 'Updated Group Room Name',
        isPrivate: true
      };
      
      // When they send the request to update the room
      const response = await request(app.getHttpServer())
        .patch(`/api/rooms/${createdRoomId}`)
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .send(updateRoomData)
        .expect(200);
      
      // Then the room should be updated successfully
      expect(response.body.name).toBe(updateRoomData.name);
      expect(response.body.isPrivate).toBe(updateRoomData.isPrivate);
    });

    it('Scenario: Non-owner cannot update room information', async () => {
      // Create a new user who is part of the room but not the owner
      const nonOwnerUser = await createTestUser(6);
      
      // Add them to the room
      await request(app.getHttpServer())
        .post(`/api/rooms/${createdRoomId}/users`)
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .send({ userId: nonOwnerUser.user.id })
        .expect(201);
      
      // Given a non-owner tries to update room information
      const updateRoomData = {
        name: 'Unauthorized Name Change',
        isPrivate: false
      };
      
      // When they send the request to update the room
      await request(app.getHttpServer())
        .patch(`/api/rooms/${createdRoomId}`)
        .set('Authorization', `Bearer ${nonOwnerUser.token}`)
        .send(updateRoomData)
        .expect(403); // Forbidden
    });

    it('Scenario: User gets room member list', async () => {
      // Given user1 wants to see all members of a room
      
      // When they send the request
      const response = await request(app.getHttpServer())
        .get(`/api/rooms/${createdRoomId}/users`)
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .expect(200);
      
      // Then they should receive a list of room members
      expect(Array.isArray(response.body)).toBe(true);
      // Room should have at least 3 members (user1, user3, and the last added user)
      expect(response.body.length).toBeGreaterThanOrEqual(3);
    });

    it('Scenario: User deletes a room they own', async () => {
      // Create a new room that will be deleted
      const roomToDeleteData = {
        name: 'Room To Delete',
        isDirect: false,
        isPrivate: false,
        isActive: true,
        userIds: []
      };
      
      const createResponse = await request(app.getHttpServer())
        .post('/api/rooms')
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .send(roomToDeleteData)
        .expect(201);
      
      const roomToDeleteId = createResponse.body.id;
      
      // When user1 deletes the room
      await request(app.getHttpServer())
        .delete(`/api/rooms/${roomToDeleteId}`)
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .expect(200);
      
      // Then the room should no longer be accessible
      await request(app.getHttpServer())
        .get(`/api/rooms/${roomToDeleteId}`)
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .expect(404); // Not Found
    });

    it('Scenario: User cannot delete a room they do not own', async () => {
      // Create a new room
      const roomData = {
        name: 'Non-Owner Delete Test Room',
        isDirect: false,
        isPrivate: false,
        isActive: true,
        userIds: []
      };
      
      const createResponse = await request(app.getHttpServer())
        .post('/api/rooms')
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .send(roomData)
        .expect(201);
      
      const roomId = createResponse.body.id;
      
      // Add user3 to the room
      await request(app.getHttpServer())
        .post(`/api/rooms/${roomId}/users`)
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .send({ userId: testUsers[2].id })
        .expect(201);
      
      // When user3 tries to delete the room they don't own
      await request(app.getHttpServer())
        .delete(`/api/rooms/${roomId}`)
        .set('Authorization', `Bearer ${accessTokens['user3']}`)
        .expect(403); // Forbidden
    });

    it('Scenario: User marks a room as inactive', async () => {
      // Create a new room to mark as inactive
      const roomData = {
        name: 'Inactive Room Test',
        isDirect: false,
        isPrivate: false,
        isActive: true,
        userIds: []
      };
      
      const createResponse = await request(app.getHttpServer())
        .post('/api/rooms')
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .send(roomData)
        .expect(201);
      
      const roomId = createResponse.body.id;
      
      // When user1 marks the room as inactive
      const updateData = {
        isActive: false
      };
      
      const response = await request(app.getHttpServer())
        .patch(`/api/rooms/${roomId}`)
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .send(updateData)
        .expect(200);
      
      // Then the room should be marked as inactive
      expect(response.body.isActive).toBe(false);
    });

    it('Scenario: User can filter rooms by type', async () => {
      // Given user1 wants to filter only direct message rooms
      
      // When they send the request with a filter
      const response = await request(app.getHttpServer())
        .get('/api/rooms?type=direct')
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .expect(200);
      
      // Then they should receive only direct message rooms
      expect(Array.isArray(response.body)).toBe(true);
      response.body.forEach(room => {
        expect(room.isDirect).toBe(true);
      });
      
      // Also check for group rooms filter
      const groupResponse = await request(app.getHttpServer())
        .get('/api/rooms?type=group')
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .expect(200);
      
      // Should receive only group rooms
      expect(Array.isArray(groupResponse.body)).toBe(true);
      groupResponse.body.forEach(room => {
        expect(room.isDirect).toBe(false);
      });
    });

    it('Scenario: User can search rooms by name', async () => {
      // Given user1 has created a room with a distinctive name
      const distinctiveName = 'UniqueSearchableRoom' + Date.now();
      const roomData = {
        name: distinctiveName,
        isDirect: false,
        isPrivate: false,
        isActive: true,
        userIds: []
      };
      
      await request(app.getHttpServer())
        .post('/api/rooms')
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .send(roomData)
        .expect(201);
      
      // When they search for rooms by name
      const response = await request(app.getHttpServer())
        .get(`/api/rooms?search=${distinctiveName}`)
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .expect(200);
      
      // Then they should find the room with the matching name
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(1);
      expect(response.body.some(room => room.name === distinctiveName)).toBe(true);
    });

    it('Scenario: User can paginate rooms', async () => {
      // Create multiple rooms to ensure pagination works
      for (let i = 0; i < 5; i++) {
        const roomData = {
          name: `Pagination Test Room ${i}`,
          isDirect: false,
          isPrivate: false,
          isActive: true,
          userIds: []
        };
        
        await request(app.getHttpServer())
          .post('/api/rooms')
          .set('Authorization', `Bearer ${accessTokens['user1']}`)
          .send(roomData)
          .expect(201);
      }
      
      // When user requests the first page with a limit
      const firstPageResponse = await request(app.getHttpServer())
        .get('/api/rooms?page=1&limit=3')
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .expect(200);
      
      // Then they should receive only the specified number of rooms
      expect(Array.isArray(firstPageResponse.body.items)).toBe(true);
      expect(firstPageResponse.body.items.length).toBeLessThanOrEqual(3);
      expect(firstPageResponse.body.meta).toBeDefined();
      expect(firstPageResponse.body.meta.totalItems).toBeGreaterThanOrEqual(5);
      
      // When they request the second page
      const secondPageResponse = await request(app.getHttpServer())
        .get('/api/rooms?page=2&limit=3')
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .expect(200);
      
      // Then they should receive different rooms
      expect(Array.isArray(secondPageResponse.body.items)).toBe(true);
      
      // Check that pages contain different rooms
      const firstPageIds = firstPageResponse.body.items.map(room => room.id);
      const secondPageIds = secondPageResponse.body.items.map(room => room.id);
      const hasOverlap = firstPageIds.some(id => secondPageIds.includes(id));
      expect(hasOverlap).toBe(false);
    });

    it('Scenario: User can create a private room', async () => {
      // Given user1 wants to create a private room
      const privateRoomData = {
        name: 'Private Test Room',
        isDirect: false,
        isPrivate: true,
        isActive: true,
        userIds: [testUsers[2].id]
      };
      
      // When they send the request to create the private room
      const response = await request(app.getHttpServer())
        .post('/api/rooms')
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .send(privateRoomData)
        .expect(201);
      
      // Then the private room should be created successfully
      expect(response.body.id).toBeDefined();
      expect(response.body.isPrivate).toBe(true);
      
      const privateRoomId = response.body.id;
      
      // A user not in the room cannot access it
      const randomUser = await createTestUser(10);
      
      await request(app.getHttpServer())
        .get(`/api/rooms/${privateRoomId}`)
        .set('Authorization', `Bearer ${randomUser.token}`)
        .expect(403); // Forbidden
      
      // User3 who was added to the room can access it
      await request(app.getHttpServer())
        .get(`/api/rooms/${privateRoomId}`)
        .set('Authorization', `Bearer ${accessTokens['user3']}`)
        .expect(200);
    });

    it('Scenario: User cannot create a room with invalid data', async () => {
      // Given user1 tries to create a room with invalid data
      
      // Case 1: Missing required field
      const missingNameData = {
        isDirect: false,
        isPrivate: false,
        isActive: true,
        userIds: []
      };
      
      await request(app.getHttpServer())
        .post('/api/rooms')
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .send(missingNameData)
        .expect(400); // Bad Request
      
      // Case 2: Invalid type for field
      const invalidTypeData = {
        name: 'Invalid Type Room',
        isDirect: 'not-a-boolean', // Should be boolean
        isPrivate: false,
        isActive: true,
        userIds: []
      };
      
      await request(app.getHttpServer())
        .post('/api/rooms')
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .send(invalidTypeData)
        .expect(400); // Bad Request
      
      // Case 3: Invalid user IDs
      const invalidUserIdsData = {
        name: 'Invalid User IDs Room',
        isDirect: false,
        isPrivate: false,
        isActive: true,
        userIds: [999999] // Non-existent user ID
      };
      
      await request(app.getHttpServer())
        .post('/api/rooms')
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .send(invalidUserIdsData)
        .expect(400); // Bad Request
    });
  });
}); 