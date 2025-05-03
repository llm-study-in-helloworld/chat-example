import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { EntityManager, MikroORM } from '@mikro-orm/core';
import { AppTestModule } from '../app-test.module';
import { TestUser, TestUserResponse, TestUsersDict, AccessTokensDict } from '../types/test-user.type';
import { Message } from '../../src/entities';

describe('MessagesController (e2e)', () => {
  let app: INestApplication;
  let em: EntityManager;
  let orm: MikroORM;
  
  // Test users and tokens
  const testUsers: TestUser[] = [];
  const accessTokens: AccessTokensDict = {};
  
  // Room and message IDs to be used across tests
  let roomId: number;
  let messageId: number;
  let replyMessageId: number;
  
  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppTestModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    em = app.get<EntityManager>(EntityManager);
    orm = app.get<MikroORM>(MikroORM);
    
    await orm.getSchemaGenerator().refreshDatabase();
    
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
    
    // Create test users
    for (let i = 1; i <= 3; i++) {
      const userData = await createTestUser(i);
      testUsers.push(userData.user);
      accessTokens[`user${i}`] = userData.token;
    }
    
    // Create a test room for messaging
    const roomResponse = await request(app.getHttpServer())
      .post('/api/rooms')
      .set('Authorization', `Bearer ${accessTokens['user1']}`)
      .send({
        name: 'Test Messages Room',
        isGroup: true,
        userIds: [testUsers[1].id, testUsers[2].id]
      })
      .expect(201);
    
    roomId = roomResponse.body.id;
  });
  
  afterAll(async () => {
    await app.close();
    await orm.close();
  });
  
  // Helper function to create a test user
  const createTestUser = async (index: number): Promise<TestUserResponse> => {
    const uniqueId = `${index}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const userData = {
      email: `messages-test-${uniqueId}@example.com`,
      password: 'password123',
      nickname: `MessagesTestUser${uniqueId}`
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
  
  describe('Feature: Message Management', () => {
    it('Scenario: User sends a message in a room', async () => {
      // Given a user wants to send a message
      const messageData = {
        content: 'Hello, this is a test message!',
        roomId: roomId
      };
      
      // When they send the message
      const response = await request(app.getHttpServer())
        .post('/api/messages')
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .send(messageData)
        .expect(201);
      
      // Then the message should be created successfully
      expect(response.body.id).toBeDefined();
      expect(response.body.content).toBe(messageData.content);
      expect(response.body.sender.id).toBe(testUsers[0].id);
      expect(response.body.replyCount).toBe(0); // Initially no replies
      
      // Save message ID for later tests
      messageId = response.body.id;
    });
    
    it('Scenario: User sends a reply to a message', async () => {
      // Given a user wants to reply to a message
      const replyData = {
        content: 'This is a reply to the previous message',
        roomId: roomId,
        parentId: messageId
      };
      
      // When they send the reply
      const response = await request(app.getHttpServer())
        .post('/api/messages')
        .set('Authorization', `Bearer ${accessTokens['user2']}`)
        .send(replyData)
        .expect(201);

      // Then the reply should be created successfully
      expect(response.body.id).toBeDefined();
      expect(response.body.content).toBe(replyData.content);
      expect(response.body.sender.id).toBe(testUsers[1].id);
      expect(response.body.parentId).toBe(messageId);
      
      // Save reply message ID for later tests
      replyMessageId = response.body.id;
      
      // Check if the original message now has a reply count of 1
      const originalMsgResponse = await request(app.getHttpServer())
        .get(`/api/messages/${messageId}`)
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .expect(200);
      
      expect(originalMsgResponse.body.replyCount).toBe(1);
    });
    
    it('Scenario: User uses dedicated reply endpoint', async () => {
      // Given a user wants to reply using the direct reply endpoint
      const replyData = {
        content: 'This is a reply using the dedicated endpoint',
        roomId: roomId
      };
      
      // When they send the reply via the dedicated endpoint
      const response = await request(app.getHttpServer())
        .post(`/api/messages/${messageId}/reply`)
        .set('Authorization', `Bearer ${accessTokens['user3']}`)
        .send(replyData)
        .expect(201);
      
      // Then the reply should be created successfully
      expect(response.body.id).toBeDefined();
      expect(response.body.content).toBe(replyData.content);
      expect(response.body.sender.id).toBe(testUsers[2].id);
      expect(response.body.parentId).toBe(messageId);
      
      // Check if the original message now has a reply count of 2
      const originalMsgResponse = await request(app.getHttpServer())
        .get(`/api/messages/${messageId}`)
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .expect(200);
      
      expect(originalMsgResponse.body.replyCount).toBe(2);
    });
    
    it('Scenario: User retrieves all replies to a message', async () => {
      // Given a message with multiple replies
      
      // When they request all replies to that message
      const response = await request(app.getHttpServer())
        .get(`/api/messages/${messageId}/replies`)
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .expect(200);
      
      // Then all replies should be returned
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2); // We added 2 replies in the previous tests
      
      // And each reply should have the parent ID
      response.body.forEach(reply => {
        expect(reply.parentId).toBe(messageId);
      });
    });
    
    it('Scenario: User retrieves messages from a room', async () => {
      // Given a room with messages
      
      // When they request messages for that room
      const response = await request(app.getHttpServer())
        .get(`/api/messages/room/${roomId}`)
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .expect(200);

      // Then they should receive the messages
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(1); // At least our 3 test messages
      
      // Verify message properties
      const originalMessage = response.body.find(msg => msg.id === messageId);
      expect(originalMessage).toBeDefined();
      expect(originalMessage.content).toBe('Hello, this is a test message!');
      expect(originalMessage.replyCount).toBe(2);
    });
    
    it('Scenario: User retrieves a specific message', async () => {
      // Given a message ID
      
      // When they request that specific message
      const response = await request(app.getHttpServer())
        .get(`/api/messages/${messageId}`)
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .expect(200);
      
      // Then they should receive the message details with reply count
      expect(response.body.id).toBe(messageId);
      expect(response.body.content).toBe('Hello, this is a test message!');
      expect(response.body.replyCount).toBe(2);
    });
    
    it('Scenario: User edits their own message', async () => {
      // Given a user wants to edit their message
      const updateData = {
        content: 'This message has been edited'
      };
      
      // When they send the update request
      const response = await request(app.getHttpServer())
        .put(`/api/messages/${messageId}`)
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .send(updateData)
        .expect(200);
      
      // Then the message should be updated and keep reply count
      expect(response.body.id).toBe(messageId);
      expect(response.body.content).toBe(updateData.content);
      expect(response.body.replyCount).toBe(2);
      
      // Verify the message was actually updated by retrieving it again
      const verifyResponse = await request(app.getHttpServer())
        .get(`/api/messages/${messageId}`)
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .expect(200);
      
      expect(verifyResponse.body.content).toBe(updateData.content);
      expect(verifyResponse.body.replyCount).toBe(2);
    });
    
    it('Scenario: User cannot edit someone else\'s message', async () => {
      // Given a user tries to edit someone else's message
      const updateData = {
        content: 'Trying to edit someone else\'s message'
      };
      
      // When they send the update request
      await request(app.getHttpServer())
        .put(`/api/messages/${messageId}`)
        .set('Authorization', `Bearer ${accessTokens['user2']}`)
        .send(updateData)
        .expect(403); // Forbidden
    });
    
    it('Scenario: User adds a reaction to a message', async () => {
      // Given a user wants to react to a message
      const reactionData = {
        messageId: messageId,
        emoji: '👍'
      };
      
      // When they send the reaction request
      const response = await request(app.getHttpServer())
        .post('/api/messages/reaction')
        .set('Authorization', `Bearer ${accessTokens['user2']}`)
        .send(reactionData)
        .expect(201);
      
      // Then the reaction should be added
      expect(response.body.success).toBe(true);
      
      // Verify the reaction was added by getting the message
      const messageResponse = await request(app.getHttpServer())
        .get(`/api/messages/${messageId}`)
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .expect(200);
      
      // Check if reactions exist and include our reaction
      expect(messageResponse.body.reactions).toBeDefined();
      expect(Array.isArray(messageResponse.body.reactions)).toBe(true);
      
      const userReaction = messageResponse.body.reactions.find(
        reaction => reaction.userId === testUsers[1].id && reaction.emoji === '👍'
      );
      expect(userReaction).toBeDefined();
    });
    
    it('Scenario: User toggles off their reaction', async () => {
      // Given a user wants to remove their reaction
      const reactionData = {
        messageId: messageId,
        emoji: '👍' // Same emoji to toggle off
      };
      
      // When they send the reaction request again
      await request(app.getHttpServer())
        .post('/api/messages/reaction')
        .set('Authorization', `Bearer ${accessTokens['user2']}`)
        .send(reactionData)
        .expect(201);
      
      // Verify the reaction was removed by getting the message
      const messageResponse = await request(app.getHttpServer())
        .get(`/api/messages/${messageId}`)
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .expect(200);
      
      // Check that the reaction is no longer present
      const userReaction = messageResponse.body.reactions?.find(
        reaction => reaction.userId === testUsers[1].id && reaction.emoji === '👍'
      );
      expect(userReaction).toBeUndefined();
    });
    
    it('Scenario: User cannot access a non-existent message', async () => {
      // Given a non-existent message ID
      const nonExistentId = 99999;
      
      // When they try to retrieve the message
      await request(app.getHttpServer())
        .get(`/api/messages/${nonExistentId}`)
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .expect(404); // Not found
    });
    
    it('Scenario: User cannot reply to a non-existent message', async () => {
      // Given a non-existent parent message ID
      const nonExistentId = 99999;
      const replyData = {
        content: 'This reply should fail',
        roomId: roomId
      };
      
      // When they try to reply to a non-existent message
      await request(app.getHttpServer())
        .post(`/api/messages/${nonExistentId}/reply`)
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .send(replyData)
        .expect(404); // Not found
    });
    
    it('Scenario: User deletes their own message', async () => {
      // Given a user wants to delete their message (use the reply message)
      
      // When they send the delete request
      await request(app.getHttpServer())
        .delete(`/api/messages/${replyMessageId}`)
        .set('Authorization', `Bearer ${accessTokens['user2']}`)
        .expect(200);
      
      // Then the message should be deleted (soft delete)
      const messageResponse = await request(app.getHttpServer())
        .get(`/api/messages/${replyMessageId}`)
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .expect(200);
      
      expect(messageResponse.body.isDeleted).toBe(true);
      expect(messageResponse.body.content).toBe('삭제된 메시지');
      
      // And the parent message's reply count should decrease
      const parentMsgResponse = await request(app.getHttpServer())
        .get(`/api/messages/${messageId}`)
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .expect(200);
      
      expect(parentMsgResponse.body.replyCount).toBe(1); // Decreased from 2 to 1
    });
    
    it('Scenario: User cannot delete someone else\'s message', async () => {
      // Given a user tries to delete someone else's message
      
      // When they send the delete request
      await request(app.getHttpServer())
        .delete(`/api/messages/${messageId}`)
        .set('Authorization', `Bearer ${accessTokens['user2']}`)
        .expect(403); // Forbidden
    });
  });

  describe('Feature: Batch Message Loading', () => {
    let parentMessages: number[] = [];

    beforeAll(async () => {
      // Create several parent messages for batch loading tests
      for (let i = 0; i < 5; i++) {
        const messageData = {
          content: `Parent message ${i + 1}`,
          roomId: roomId
        };
        
        const response = await request(app.getHttpServer())
          .post('/api/messages')
          .set('Authorization', `Bearer ${accessTokens['user1']}`)
          .send(messageData)
          .expect(201);
          
        parentMessages.push(response.body.id);
      }
      
      // Add replies to some of the parent messages
      // Parent 0: 3 replies
      // Parent 1: 1 reply
      // Parent 2: 0 replies
      // Parent 3: 2 replies
      // Parent 4: 0 replies
      const replyDistribution = [3, 1, 0, 2, 0];
      
      for (let i = 0; i < parentMessages.length; i++) {
        for (let j = 0; j < replyDistribution[i]; j++) {
          const replyData = {
            content: `Reply ${j + 1} to parent message ${i + 1}`,
            roomId: roomId,
            parentId: parentMessages[i]
          };
          
          await request(app.getHttpServer())
            .post('/api/messages')
            .set('Authorization', `Bearer ${accessTokens['user2']}`)
            .send(replyData)
            .expect(201);
        }
      }
    });

    it('Scenario: Batch loading correctly counts replies for multiple messages', async () => {
      // Given a room with multiple parent messages and replies
      
      // When retrieving all messages
      const response = await request(app.getHttpServer())
        .get(`/api/messages/room/${roomId}`)
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .expect(200);
      
      // Then each parent message should have the correct reply count
      const expectedReplyCounts = [3, 1, 0, 2, 0];
      
      for (let i = 0; i < parentMessages.length; i++) {
        const parentMsg = response.body.find(msg => msg.id === parentMessages[i]);
        expect(parentMsg).toBeDefined();
        expect(parentMsg.replyCount).toBe(expectedReplyCounts[i]);
      }
    });

    it('Scenario: Getting replies for a message with many replies works efficiently', async () => {
      // Given a parent message with multiple replies (using the first parent with 3 replies)
      const parentWithManyReplies = parentMessages[0];
      
      // When requesting all replies
      const response = await request(app.getHttpServer())
        .get(`/api/messages/${parentWithManyReplies}/replies`)
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .expect(200);
      
      // Then all replies should be returned with correct structure
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(3);
      
      // And all should have the same parent ID
      response.body.forEach(reply => {
        expect(reply.parentId).toBe(parentWithManyReplies);
      });
    });

    it('Scenario: Testing performance of optimized batch query', async () => {
      // Given we have existing parent messages with replies
      
      // Create additional test messages for more data volume
      const additionalParents: number[] = [];
      
      // Add 10 more parent messages
      for (let i = 0; i < 10; i++) {
        const messageData = {
          content: `Performance test parent ${i + 1}`,
          roomId: roomId
        };
        
        const response = await request(app.getHttpServer())
          .post('/api/messages')
          .set('Authorization', `Bearer ${accessTokens['user1']}`)
          .send(messageData)
          .expect(201);
          
        additionalParents.push(response.body.id);
      }
      
      // Add 3 replies to each new parent
      for (const parentId of additionalParents) {
        for (let j = 0; j < 3; j++) {
          await request(app.getHttpServer())
            .post('/api/messages')
            .set('Authorization', `Bearer ${accessTokens['user2']}`)
            .send({
              content: `Performance reply ${j + 1}`,
              roomId: roomId,
              parentId: parentId
            })
            .expect(201);
        }
      }
      
      // When measuring the time to get all messages with reply counts
      const startTime = Date.now();
      
      const response = await request(app.getHttpServer())
        .get(`/api/messages/room/${roomId}`)
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .expect(200);
        
      const endTime = Date.now();
      const queryTime = endTime - startTime;
      
      // Log the performance metrics
      console.log(`Batch query for ${response.body.length} messages completed in ${queryTime}ms`);
      
      // Then all messages should have the correct reply count
      // Check the new messages have 3 replies each
      for (const parentId of additionalParents) {
        const parentMsg = response.body.find(msg => msg.id === parentId);
        expect(parentMsg).toBeDefined();
        expect(parentMsg.replyCount).toBe(3);
      }
      
      // And verify the performance is reasonable
      // This is a soft assertion as exact time depends on hardware
      expect(queryTime).toBeLessThan(5000); // Should complete in under 5 seconds
    });
  });
}); 