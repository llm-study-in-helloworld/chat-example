import { EntityManager, MikroORM } from '@mikro-orm/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/postgresql';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  Mention,
  Message,
  MessageReaction,
  Room,
  User
} from '../../src/entities';
import { LoggerService } from '../../src/logger/logger.service';
import { MessagesService } from '../../src/messages/messages.service';
import testConfig from '../mikro-orm.config.test';
import { createMockLoggerService } from './fixtures/logger.fixtures';
import { createMessageFixture, createReplyMessageFixture, TestMessageData } from './fixtures/message.fixtures';
import { createRoomFixture, TestRoomData } from './fixtures/room.fixtures';
import { createUserFixture, TestUserData } from './fixtures/user.fixtures';

describe('MessagesService', () => {
  let service: MessagesService;
  let orm: MikroORM;
  let em: EntityManager;
  let messageRepository: EntityRepository<Message>;
  let userRepository: EntityRepository<User>;
  let roomRepository: EntityRepository<Room>;
  let loggerService: LoggerService;

  // Test data
  let testUser1: User;
  let testUser2: User;
  let testUser1Data: TestUserData;
  let testUser2Data: TestUserData;
  let testRoom: Room;
  let testRoomData: TestRoomData;
  let testMessage: Message;
  let testMessageData: TestMessageData;
  let testReplyMessage: Message;
  let testReplyMessageData: TestMessageData;

  beforeAll(async () => {
    // Create mock logger service
    const mockLoggerService = createMockLoggerService();
    
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        MikroOrmModule.forRoot(testConfig),
        MikroOrmModule.forFeature({
          entities: [User, Room, Message, MessageReaction, Mention]
        }),
      ],
      providers: [
        MessagesService,
        {
          provide: LoggerService,
          useValue: mockLoggerService,
        },
      ],
    }).compile();

    service = module.get<MessagesService>(MessagesService);
    orm = module.get<MikroORM>(MikroORM);
    em = module.get<EntityManager>(EntityManager);
    messageRepository = em.getRepository(Message);
    userRepository = em.getRepository(User);
    roomRepository = em.getRepository(Room);
    loggerService = module.get<LoggerService>(LoggerService);

    // Create schema
    await orm.getSchemaGenerator().createSchema();
  });

  beforeEach(async () => {
    // Clear database before each test
    await orm.getSchemaGenerator().refreshDatabase();

    // Create test users using fixtures
    testUser1Data = await createUserFixture(em, {
      email: 'test1@example.com',
      nickname: 'TestUser1',
      password: 'password1',
      imageUrl: 'http://example.com/avatar1.jpg'
    });
    
    testUser2Data = await createUserFixture(em, {
      email: 'test2@example.com',
      nickname: 'TestUser2',
      password: 'password2',
      imageUrl: 'http://example.com/avatar2.jpg'
    });
    
    // Get the actual user entities for tests that need them
    testUser1 = await userRepository.findOneOrFail({ id: testUser1Data.id });
    testUser2 = await userRepository.findOneOrFail({ id: testUser2Data.id });

    // Create a test room using fixture
    testRoomData = await createRoomFixture(em, testUser1Data, [testUser2Data], {
      name: 'Test Room',
      isPrivate: false
    });
    
    // Get the actual room entity for tests that need it
    testRoom = await roomRepository.findOneOrFail({ id: testRoomData.id });

    // Create a test message using fixture
    testMessageData = await createMessageFixture(em, testRoomData, testUser1Data, {
      content: 'Test message content'
    });
    
    // Create a reply message using fixture
    testReplyMessageData = await createReplyMessageFixture(
      em, 
      testRoomData, 
      testUser2Data, 
      testMessageData, 
      { content: 'Test reply content' }
    );
    
    // Get the actual message entities for tests that need them
    testMessage = await messageRepository.findOneOrFail({ id: testMessageData.id });
    testReplyMessage = await messageRepository.findOneOrFail({ id: testReplyMessageData.id });

    // Reset mocks
    jest.clearAllMocks();
    
    // Clear EntityManager to ensure fresh state for each test
    em.clear();
  });

  afterAll(async () => {
    await orm.close();
  });

  describe('getRoomMessages', () => {
    it('should return messages from a room', async () => {
      // Act
      const messages = await service.getRoomMessages(testRoom.id);

      // Assert
      expect(messages).toBeDefined();
      expect(Array.isArray(messages)).toBe(true);
      expect(messages.length).toBeGreaterThanOrEqual(1);
      
      // Check dto properties
      const message = messages.find(m => m.id === testMessage.id);
      expect(message).toBeDefined();
      if (message) {
        expect(message.content).toBe('Test message content');
        expect(message.sender.id).toBe(testUser1.id);
        expect(message.replyCount).toBe(1); // Should have one reply
      }
      
      // Verify logger was called
      expect(loggerService.logMethodEntry).toHaveBeenCalled();
      expect(loggerService.logMethodExit).toHaveBeenCalled();
    });

    it('should respect limit and offset parameters', async () => {
      // Arrange - Create additional messages
      for (let i = 0; i < 5; i++) {
        const msg = new Message();
        msg.content = `Additional message ${i}`;
        msg.room = testRoom.id;
        msg.sender = testUser1;
        await em.persistAndFlush(msg);
      }
      em.clear();

      // Act - Get with limit
      const messages1 = await service.getRoomMessages(testRoom.id, 3, 0);
      const messages2 = await service.getRoomMessages(testRoom.id, 3, 3);

      // Assert
      expect(messages1.length).toBe(3);
      expect(messages2.length).toBe(3);
      
      // Different messages should be returned due to offset
      const ids1 = messages1.map(m => m.id);
      const ids2 = messages2.map(m => m.id);
      expect(ids1.some(id => ids2.includes(id))).toBe(false);
      
      // Verify logger was called
      expect(loggerService.logMethodEntry).toHaveBeenCalledTimes(2);
      expect(loggerService.logMethodExit).toHaveBeenCalledTimes(2);
    });
  });

  describe('getMessage', () => {
    it('should return a single message with reply count', async () => {
      // Act
      const message = await service.getMessage(testMessage.id);

      // Assert
      expect(message).toBeDefined();
      if (message) {
        expect(message.id).toBe(testMessage.id);
        expect(message.content).toBe('Test message content');
        expect(message.sender.id).toBe(testUser1.id);
        expect(message.replyCount).toBe(1); // Should have one reply
      }
    });

    it('should return a reply message with parent reference info', async () => {
      // Act
      const message = await service.getMessage(testReplyMessage.id);

      // Assert
      expect(message).toBeDefined();
      if (message) {
        expect(message.id).toBe(testReplyMessage.id);
        expect(message.content).toBe('Test reply content');
        expect(message.parentId).toBe(testMessage.id);
        
        // 답변은 부모 메시지 참조를 포함하지만, 내용은 포함하지 않아야 함
        expect(message.parentId).toBe(testMessage.id);
      }
    });

    it('should return null for non-existent message', async () => {
      // Act
      const message = await service.getMessage(999999);

      // Assert
      expect(message).toBeNull();
    });
  });

  describe('createMessage', () => {
    it('should create a new message', async () => {
      // Act
      const result = await service.createMessage({
        content: 'New message from unit test',
        roomId: testRoom.id,
        senderId: testUser1.id
      });

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.content).toBe('New message from unit test');
      expect(result.sender.id).toBe(testUser1.id);
      expect(result.replyCount).toBe(0); // New message, no replies yet
      
      // Verify message was saved to database
      const savedMessage = await messageRepository.findOne({ id: result.id });
      expect(savedMessage).toBeDefined();
      expect(savedMessage!.content).toBe('New message from unit test');
    });

    it('should create a reply message with parent reference', async () => {
      // Act
      const result = await service.createMessage({
        content: 'New reply from unit test',
        roomId: testRoom.id,
        senderId: testUser2.id,
        parentId: testMessage.id
      });

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.content).toBe('New reply from unit test');
      expect(result.sender.id).toBe(testUser2.id);
      expect(result.parentId).toBe(testMessage.id);
      
      // Verify reply was saved to database
      const savedReply = await messageRepository.findOne(
        { id: result.id },
      );
      expect(savedReply).toBeDefined();
      if (savedReply && savedReply.parent) {
        expect(savedReply.parent).toBe(testMessage.id);
      }
      
      // Check if parent message now has 2 replies
      const updatedParent = await service.getMessage(testMessage.id);
      expect(updatedParent!.replyCount).toBe(2);
    });

    it('should extract and save mentions when creating a message', async () => {
      // Act - Create message with mentions
      const result = await service.createMessage({
        content: 'Message with mentions @TestUser1 and @TestUser2',
        roomId: testRoom.id,
        senderId: testUser1.id
      });

      // Assert
      expect(result).toBeDefined();
      
      // Verify mentions were saved
      const message = await messageRepository.findOne(
        { id: result.id },
        { populate: ['mentions', 'mentions.mentionedUser'] }
      );
      
      expect(message!.mentions.length).toBe(2);
      
      // Check both users are mentioned
      const mentionedUserIds = message!.mentions.getItems().map(m => m.mentionedUser.id);
      expect(mentionedUserIds).toContain(testUser1.id);
      expect(mentionedUserIds).toContain(testUser2.id);
    });

    it('should handle messages with no mentions', async () => {
      // Act - Create message without mentions
      const result = await service.createMessage({
        content: 'Message with no mentions',
        roomId: testRoom.id,
        senderId: testUser1.id
      });

      // Verify no mentions were created
      const message = await messageRepository.findOne(
        { id: result.id },
        { populate: ['mentions'] }
      );
      
      expect(message!.mentions.length).toBe(0);
    });

    it('should handle invalid mentions gracefully', async () => {
      // Act - Create message with invalid mention
      const result = await service.createMessage({
        content: 'Message mentioning @NonExistentUser',
        roomId: testRoom.id,
        senderId: testUser1.id
      });

      // Verify no mentions were created for non-existent user
      const message = await messageRepository.findOne(
        { id: result.id },
        { populate: ['mentions'] }
      );
      
      expect(message!.mentions.length).toBe(0);
    });
  });

  describe('updateMessage', () => {
    it('should update message content', async () => {
      // Act
      const result = await service.updateMessage(testMessage.id, testUser1.id, {
        content: 'Updated content'
      });

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe(testMessage.id);
      expect(result.content).toBe('Updated content');
      
      // Verify update in database
      const updatedMessage = await messageRepository.findOne({ id: testMessage.id });
      expect(updatedMessage!.content).toBe('Updated content');
    });

    it('should throw ForbiddenException when user is not the sender', async () => {
      // Act & Assert
      await expect(
        service.updateMessage(testMessage.id, testUser2.id, {
          content: 'This should fail'
        })
      ).rejects.toThrow(ForbiddenException);
      
      // Verify message was not changed
      const message = await messageRepository.findOne({ id: testMessage.id });
      expect(message!.content).toBe('Test message content');
    });

    it('should throw NotFoundException for non-existent message', async () => {
      // Act & Assert
      await expect(
        service.updateMessage(999999, testUser1.id, {
          content: 'This should fail'
        })
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle mentions in updated content', async () => {
      // Act
      const result = await service.updateMessage(testMessage.id, testUser1.id, {
        content: 'Updated with mention @TestUser2'
      });

      // Assert
      expect(result).toBeDefined();
      expect(result.content).toBe('Updated with mention @TestUser2');
      
      // Reload message with mentions
      const updatedMessage = await messageRepository.findOne(
        { id: testMessage.id },
        { populate: ['mentions', 'mentions.mentionedUser'] }
      );
      
      // Verify mention was created
      expect(updatedMessage!.mentions.length).toBe(1);
      expect(updatedMessage!.mentions[0].mentionedUser.id).toBe(testUser2.id);
    });
  });

  describe('deleteMessage', () => {
    it('should soft delete a message', async () => {
      // Act
      const result = await service.deleteMessage(testMessage.id, testUser1.id);

      // Assert
      expect(result).toBe(true);
      
      // Verify soft delete in database
      const deletedMessage = await messageRepository.findOne({ id: testMessage.id });
      expect(deletedMessage!.deletedAt).toBeDefined();
    });

    it('should throw ForbiddenException when user is not the sender', async () => {
      // Act & Assert
      await expect(
        service.deleteMessage(testMessage.id, testUser2.id)
      ).rejects.toThrow(ForbiddenException);
      
      // Verify message was not deleted
      const message = await messageRepository.findOne({ id: testMessage.id });
      expect(message!.deletedAt).not.toBeDefined();
    });

    it('should throw NotFoundException for non-existent message', async () => {
      // Act & Assert
      await expect(
        service.deleteMessage(999999, testUser1.id)
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('toggleReaction', () => {
    it('should add a reaction to a message', async () => {
      // Act
      const reaction = await service.toggleReaction(testMessage.id, testUser2.id, '👍');

      // Assert
      expect(reaction).toBeDefined();
      expect(reaction!.emoji).toBe('👍');
      expect(reaction!.user.id).toBe(testUser2.id);
      expect(reaction!.messageId).toBe(testMessage.id);
      
      // Verify reaction was saved to database
      const message = await messageRepository.findOne(
        { id: testMessage.id },
        { populate: ['reactions', 'reactions.user'] }
      );
      expect(message!.reactions.length).toBe(1);
      expect(message!.reactions[0].emoji).toBe('👍');
    });

    it('should remove a reaction when toggled twice', async () => {
      // Arrange - Add reaction first
      await service.toggleReaction(testMessage.id, testUser2.id, '👍');
      
      // Act - Toggle again to remove
      const result = await service.toggleReaction(testMessage.id, testUser2.id, '👍');

      // Assert
      expect(result).toBeNull();
      
      // Verify reaction was removed from database
      const message = await messageRepository.findOne(
        { id: testMessage.id },
        { populate: ['reactions'] }
      );
      expect(message!.reactions.length).toBe(0);
    });
  });

  describe('findReplies', () => {
    it('should return all replies for a parent message', async () => {
      // Arrange - Add more replies
      const reply2 = new Message();
      reply2.content = 'Another reply';
      reply2.room = testRoom.id;
      reply2.sender = testUser1;
      reply2.parent = testMessage.id;
      await em.persistAndFlush(reply2);
      em.clear();

      // Act
      const replies = await service.findReplies(testMessage.id);

      // Assert
      expect(replies).toBeDefined();
      expect(Array.isArray(replies)).toBe(true);
      expect(replies.length).toBe(2);
      
      // 각 답변은 부모 메시지 ID를 포함해야 함
      replies.forEach(reply => {
        expect(reply.parentId).toBe(testMessage.id);
      });
    });

    it('should return empty array for message with no replies', async () => {
      // Act
      const replies = await service.findReplies(testReplyMessage.id);

      // Assert
      expect(replies).toBeDefined();
      expect(Array.isArray(replies)).toBe(true);
      expect(replies.length).toBe(0);
    });
  });

  describe('findByRoom', () => {
    it('should return all non-deleted messages in a room', async () => {
      // Arrange - Add more messages and delete one
      const messageToDelete = new Message();
      messageToDelete.content = 'This will be deleted';
      messageToDelete.room = testRoom.id;
      messageToDelete.sender = testUser1;
      
      const normalMessage = new Message();
      normalMessage.content = 'Another normal message';
      normalMessage.room = testRoom.id;
      normalMessage.sender = testUser2;
      
      await em.persistAndFlush([messageToDelete, normalMessage]);
      
      // Delete one message
      messageToDelete.deletedAt = new Date();
      await em.flush();
      em.clear();

      // Act
      const messages = await service.findByRoom(testRoom.id);

      // Assert
      expect(messages).toBeDefined();
      expect(Array.isArray(messages)).toBe(true);
      
      // Should contain non-deleted messages
      expect(messages.some(m => m.id === normalMessage.id)).toBe(true);
      
      // Should not contain deleted messages
      expect(messages.some(m => m.id === messageToDelete.id)).toBe(false);
      
      // Check reply counts
      const parentMessage = messages.find(m => m.id === testMessage.id);
      expect(parentMessage!.replyCount).toBe(1);
    });
  });

  describe('batch optimization', () => {
    it('should efficiently load multiple messages with reply counts', async () => {
      // Arrange - Create 5 parent messages and various replies
      const parents: Message[] = [];
      for (let i = 0; i < 5; i++) {
        const msg = new Message();
        msg.content = `Parent ${i}`;
        msg.room = testRoom.id;
        msg.sender = testUser1;
        await em.persistAndFlush(msg);
        parents.push(msg);
      }
      
      // Add replies: 2, 0, 3, 1, 0 replies respectively
      const replyDistribution = [2, 0, 3, 1, 0];
      
      for (let i = 0; i < parents.length; i++) {
        for (let j = 0; j < replyDistribution[i]; j++) {
          const reply = new Message();
          reply.content = `Reply ${j} to parent ${i}`;
          reply.room = testRoom.id;
          reply.sender = testUser2;
          reply.parent = parents[i].id;
          await em.persistAndFlush(reply);
        }
      }
      
      em.clear();

      // Act - Get all messages
      const messages = await service.findByRoom(testRoom.id);

      // Assert
      expect(messages).toBeDefined();
      
      // Check that each parent has correct reply count
      for (let i = 0; i < parents.length; i++) {
        const parent = messages.find(m => m.id === parents[i].id);
        expect(parent).toBeDefined();
        expect(parent!.replyCount).toBe(replyDistribution[i]);
      }
    });

    it('should optimize query with single SQL statement', async () => {
      // This test requires spying on the entityManager's execute method
      // to verify it's using a single SQL statement for counting replies
      
      // Arrange - Create 20 parent messages with varying replies
      const parents: Message[] = [];
      for (let i = 0; i < 20; i++) {
        const msg = new Message();
        msg.content = `Parent ${i}`;
        msg.room = testRoom.id;
        msg.sender = testUser1;
        await em.persistAndFlush(msg);
        parents.push(msg);
        
        // Add replies (0-2 per parent)
        const replyCount = i % 3;
        for (let j = 0; j < replyCount; j++) {
          const reply = new Message();
          reply.content = `Reply to parent ${i}`;
          reply.room = testRoom.id;
          reply.sender = testUser2;
          reply.parent = msg.id;
          await em.persistAndFlush(reply);
        }
      }
      
      em.clear();
      
      // Spy on em.getConnection().execute method
      const executeSpy = jest.spyOn(em.getConnection(), 'execute');

      // Act
      const messages = await service.findByRoom(testRoom.id);
      
      // Assert
      // Should contain SQL with GROUP BY - only one call for counting
      const groupByCalls = executeSpy.mock.calls.filter(call => 
        typeof call[0] === 'string' && 
        call[0].includes('GROUP BY parent_id')
      );
      
      expect(groupByCalls.length).toBe(1);
      
      // Verify all parent messages have the correct reply count
      for (let i = 0; i < 20; i++) {
        const parent = messages.find(m => m.content === `Parent ${i}`);
        expect(parent).toBeDefined();
        expect(parent!.replyCount).toBe(i % 3);
      }
      
      // Clean up spy
      executeSpy.mockRestore();
    });
  });
}); 