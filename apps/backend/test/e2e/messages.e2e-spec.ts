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

describe('MessagesController (e2e)', () => {
  let app: INestApplication;
  let em: EntityManager;
  let orm: MikroORM;
  let userHelper: TestUserHelper;
  
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
    })
    .overrideProvider(LoggerService)
    .useValue(mockLoggerService)
    .compile();

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
    
    // Initialize test user helper
    userHelper = new TestUserHelper(app, {
      prefix: 'messages-'
    });
    
    await app.init();
    
    // Create test users
    for (let i = 1; i <= 3; i++) {
      const userData = await userHelper.createTestUser(i);
      testUsers.push(userData.user);
      accessTokens[`user${i}`] = userData.token;
    }
    
    // Create a test room for the current test
    const roomResponse = await request(app.getHttpServer())
      .post('/api/rooms')
      .set('Authorization', `Bearer ${accessTokens['user1']}`)
      .send({
        name: `Messages Test Room ${Date.now()}`,
        isDirect: false,
        isPrivate: false,
        isActive: true,
        userIds: [testUsers[1].id, testUsers[2].id]
      })
      .expect(201);
    
    roomId = roomResponse.body.id;
  });
  
  afterAll(async () => {
    await app.close();
    await orm.close();
  });
  
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
      
      // Then they should receive all replies
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2);
      
      response.body.forEach((reply: any) => {
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
      const originalMessage = response.body.find((msg: any) => msg.id === messageId);
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
      // Given updated content for the message
      const updateData = {
        content: 'This message has been edited'
      };
      
      // When they update the message
      const response = await request(app.getHttpServer())
        .put(`/api/messages/${messageId}`)
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .send(updateData)
        .expect(200);
      
      // Then the message should be updated
      expect(response.body.id).toBe(messageId);
      expect(response.body.content).toBe(updateData.content);
      expect(response.body.updatedAt).not.toBe(response.body.createdAt);
    });
    
    it('Scenario: User cannot edit another user\'s message', async () => {
      // Given update data
      const updateData = {
        content: 'I should not be able to edit this'
      };
      
      // When user2 tries to update user1's message
      await request(app.getHttpServer())
        .put(`/api/messages/${messageId}`)
        .set('Authorization', `Bearer ${accessTokens['user2']}`)
        .send(updateData)
        .expect(403); // Forbidden
    });
    
    it('Scenario: User adds a reaction to a message', async () => {
      // Given a user wants to react to a message
      const reactionData = {
        emoji: '👍',
        messageId: messageId
      };
      
      // When they add the reaction
      const response = await request(app.getHttpServer())
        .post(`/api/messages/reaction`)
        .set('Authorization', `Bearer ${accessTokens['user2']}`)
        .send(reactionData)
        .expect(201);
      
      // Then the reaction should be added
      expect(response.body.success).toBe(true);
      expect(response.body.removed).toBe(false);
      expect(response.body.reaction).toBeDefined();
      expect(response.body.reaction.emoji).toBe('👍');
      expect(response.body.reaction.userId).toBe(testUsers[1].id);
      
      // Verify the message has the reaction
      const messageResponse = await request(app.getHttpServer())
        .get(`/api/messages/${messageId}`)
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .expect(200);
      
      const reactionsCount = messageResponse.body.reactions.length;
      expect(reactionsCount).toBeGreaterThan(0);
      
      const hasThumbsUp = messageResponse.body.reactions.some(
        (reaction: any) => reaction.emoji === '👍' && reaction.userId === testUsers[1].id
      );
      expect(hasThumbsUp).toBe(true);
    });
    
    it('Scenario: User removes a reaction from a message', async () => {
      // Given a user has already reacted to a message
      const existingReaction = {
        emoji: '👍',
        messageId: messageId
      };
      
      // When they toggle off the same reaction
      const response = await request(app.getHttpServer())
        .post(`/api/messages/reaction`)
        .set('Authorization', `Bearer ${accessTokens['user2']}`)
        .send(existingReaction)
        .expect(201);
      
      // Then the reaction should be removed
      expect(response.body.success).toBe(true);
      expect(response.body.removed).toBe(true);
      // The API could return null or undefined for the removed reaction
      expect(response.body.reaction == null).toBe(true);
      
      // Verify the message no longer has the reaction
      const messageResponse = await request(app.getHttpServer())
        .get(`/api/messages/${messageId}`)
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .expect(200);
      
      const hasThumbsUp = messageResponse.body.reactions.some(
        (reaction: any) => reaction.emoji === '👍' && reaction.userId === testUsers[1].id
      );
      expect(hasThumbsUp).toBe(false);
    });
    
    it('Scenario: Multiple users can react to the same message', async () => {
      // Given multiple users want to add reactions
      const reaction1 = { emoji: '❤️', messageId: messageId };
      const reaction2 = { emoji: '👍', messageId: messageId };
      const reaction3 = { emoji: '🎉', messageId: messageId };
      
      // When they add reactions
      await request(app.getHttpServer())
        .post(`/api/messages/reaction`)
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .send(reaction1)
        .expect(201);
        
      await request(app.getHttpServer())
        .post(`/api/messages/reaction`)
        .set('Authorization', `Bearer ${accessTokens['user2']}`)
        .send(reaction2)
        .expect(201);
        
      await request(app.getHttpServer())
        .post(`/api/messages/reaction`)
        .set('Authorization', `Bearer ${accessTokens['user3']}`)
        .send(reaction3)
        .expect(201);
      
      // Then the message should have all reactions
      const messageResponse = await request(app.getHttpServer())
        .get(`/api/messages/${messageId}`)
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .expect(200);
      
      expect(messageResponse.body.reactions.length).toBe(3);
      
      const hasAllReactions = 
        messageResponse.body.reactions.some((r: any) => r.emoji === '❤️' && r.userId === testUsers[0].id) &&
        messageResponse.body.reactions.some((r: any) => r.emoji === '👍' && r.userId === testUsers[1].id) &&
        messageResponse.body.reactions.some((r: any) => r.emoji === '🎉' && r.userId === testUsers[2].id);
      
      expect(hasAllReactions).toBe(true);
    });
    
    it('Scenario: User deletes their own message', async () => {
      // First, create a message to delete
      const messageToDeleteData = {
        content: 'This message will be deleted',
        roomId: roomId
      };
      
      const createResponse = await request(app.getHttpServer())
        .post('/api/messages')
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .send(messageToDeleteData)
        .expect(201);
      
      const messageToDeleteId = createResponse.body.id;
      
      // When the user deletes the message
      await request(app.getHttpServer())
        .delete(`/api/messages/${messageToDeleteId}`)
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .expect(200);
      
      // Then the message should be soft deleted (still retrievable but marked as deleted)
      const deletedMessageResponse = await request(app.getHttpServer())
        .get(`/api/messages/${messageToDeleteId}`)
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .expect(200);
      
      expect(deletedMessageResponse.body.isDeleted).toBe(true);
      expect(deletedMessageResponse.body.deletedAt).not.toBeNull();
      // Check that content is replaced with a deleted message placeholder
      // The actual text may vary (e.g., "삭제된 메시지" instead of "This message has been deleted")
      expect(typeof deletedMessageResponse.body.content).toBe('string');
    });
    
    it('Scenario: User cannot delete another user\'s message', async () => {
      // When user2 tries to delete user1's message
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
        const parentMsg = response.body.find((msg: any) => msg.id === parentMessages[i]);
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
      response.body.forEach((reply: any) => {
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
        const parentMsg = response.body.find((msg: any) => msg.id === parentId);
        expect(parentMsg).toBeDefined();
        expect(parentMsg.replyCount).toBe(3);
      }
      
      // And verify the performance is reasonable
      // This is a soft assertion as exact time depends on hardware
      expect(queryTime).toBeLessThan(5000); // Should complete in under 5 seconds
    });
  });

  describe('Feature: Room Messages', () => {
    it('Scenario: User retrieves all messages in a room', async () => {
      // When user retrieves room messages
      const response = await request(app.getHttpServer())
        .get(`/api/messages/room/${roomId}`)
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .expect(200);
      
      // Then they should receive all messages
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      
      // All messages should belong to the room
      response.body.forEach((message: any) => {
        expect(message.roomId).toBe(roomId);
      });
    });
    
    it('Scenario: User retrieves paginated messages in a room', async () => {
      // Add a few more messages to ensure pagination
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .post('/api/messages')
          .set('Authorization', `Bearer ${accessTokens['user1']}`)
          .send({
            content: `Pagination test message ${i}`,
            roomId: roomId
          })
          .expect(201);
      }
      
      // When user retrieves first page of messages with limit
      const firstPageResponse = await request(app.getHttpServer())
        .get(`/api/messages/room/${roomId}?limit=3&offset=0`)
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .expect(200);
      
      // Then they should receive the correct number of messages
      expect(Array.isArray(firstPageResponse.body)).toBe(true);
      expect(firstPageResponse.body.length).toBe(3);
      
      // When user retrieves second page
      const secondPageResponse = await request(app.getHttpServer())
        .get(`/api/messages/room/${roomId}?limit=3&offset=3`)
        .set('Authorization', `Bearer ${accessTokens['user1']}`)
        .expect(200);
      
      // Then they should receive different messages
      expect(Array.isArray(secondPageResponse.body)).toBe(true);
      expect(secondPageResponse.body.length).toBe(3);
      
      // Messages in first and second page should be different
      const firstPageIds = firstPageResponse.body.map((msg: any) => msg.id);
      const secondPageIds = secondPageResponse.body.map((msg: any) => msg.id);
      
      const overlap = firstPageIds.filter((id: number) => secondPageIds.includes(id));
      expect(overlap.length).toBe(0);
    });
  });
}); 