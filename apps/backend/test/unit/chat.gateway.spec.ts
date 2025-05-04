import { Test, TestingModule } from '@nestjs/testing';
import { Server, Socket } from 'socket.io';
import { AuthService } from '../../src/auth';
import { MessageReactionResponseDto, MessageResponseDto, RoomResponseDto, UserResponseDto } from '../../src/dto';
import { MessageReaction, User } from '../../src/entities';
import { ChatGateway } from '../../src/gateway/chat.gateway';
import { LoggerService } from '../../src/logger/logger.service';
import { CreateMessageDto } from '../../src/messages/dto/create-message.dto';
import { ReactionDto } from '../../src/messages/dto/reaction.dto';
import { MessagesService } from '../../src/messages/messages.service';
import { RoomsService } from '../../src/rooms/rooms.service';
import { createMockLoggerService } from '../fixtures/logger.fixtures';

describe('ChatGateway', () => {
  let gateway: ChatGateway;
  let authService: AuthService;
  let messagesService: MessagesService;
  let roomsService: RoomsService;
  let loggerService: LoggerService;
  let mockServer: Partial<Server>;

  // Test data
  const testUser1: User = {
    id: 1,
    email: 'test1@example.com',
    nickname: 'TestUser1',
    imageUrl: 'http://example.com/avatar1.jpg',
  } as User;

  const testUser2: User = {
    id: 2,
    email: 'test2@example.com',
    nickname: 'TestUser2',
    imageUrl: 'http://example.com/avatar2.jpg',
  } as User;

  const testRoom1: RoomResponseDto = {
    id: 1,
    name: 'Test Room 1',
    isDirect: false,
    isPrivate: false,
    isActive: true,
    ownerId: 1,
    description: '',
    imageUrl: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    unreadCount: 0
  };

  const testRoom2: RoomResponseDto = {
    id: 2,
    name: 'Test Room 2',
    isDirect: true,
    isPrivate: true,
    isActive: true,
    ownerId: 1,
    description: '',
    imageUrl: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    unreadCount: 0
  };

  // Mock response DTOs
  const testReactionResponseDto: MessageReactionResponseDto = {
    id: 1,
    emoji: '👍',
    userId: 1,
    messageId: 1,
    createdAt: '',
    user: {
      id: 1,
      nickname: 'TestUser1',
      imageUrl: 'http://example.com/avatar1.jpg',
    } as Pick<UserResponseDto, 'id' | 'nickname' | 'imageUrl'>
  };

  const testMessageResponse: Partial<MessageResponseDto> = {
    id: 1,
    content: 'Test message content',
    createdAt: '2023-01-01T00:00:00.000Z',
    updatedAt: '2023-01-01T00:00:00.000Z',
    deletedAt: null,
    isDeleted: false,
    parentId: null,
    roomId: 1,
    sender: {
      id: 1,
      nickname: 'TestUser1',
      imageUrl: 'http://example.com/avatar1.jpg',
    },
    reactions: [],
    mentions: [],
    replyCount: 0,
  };

  // Reaction entity for service mocks
  const testReaction: Partial<MessageReaction> = {
    id: 1,
    emoji: '👍',
    user: testUser1,
    messageId: 1,
  } as Partial<MessageReaction>;

  // Mock Socket
  let mockSocket: Partial<Socket>;

  beforeEach(async () => {
    // Create mock logger service
    const mockLoggerService = createMockLoggerService();
    
    // Create mock socket with proper structure
    mockSocket = {
      handshake: {
        headers: {
          authorization: 'Bearer valid-token',
        },
        address: { address: '127.0.0.1', port: 1234 },
        time: new Date().toString(),
        query: {},
        auth: {},
        url: '',
        xdomain: false,
        secure: false,
        issued: Date.now(),
      },
      data: {},
      join: jest.fn(),
      disconnect: jest.fn(),
    } as unknown as Partial<Socket>;

    mockServer = {
      emit: jest.fn(),
      to: jest.fn().mockReturnThis(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatGateway,
        {
          provide: AuthService,
          useValue: {
            validateToken: jest.fn(),
          },
        },
        {
          provide: MessagesService,
          useValue: {
            createMessage: jest.fn(),
            getMessage: jest.fn(),
            updateMessage: jest.fn(),
            toggleReaction: jest.fn(),
            canEditMessage: jest.fn(),
          },
        },
        {
          provide: RoomsService,
          useValue: {
            getUserRooms: jest.fn(),
            canUserJoinRoom: jest.fn(),
            updateLastSeen: jest.fn(),
            getRoomById: jest.fn(),
          },
        },
        {
          provide: LoggerService,
          useValue: mockLoggerService,
        },
      ],
    }).compile();

    gateway = module.get<ChatGateway>(ChatGateway);
    authService = module.get<AuthService>(AuthService);
    messagesService = module.get<MessagesService>(MessagesService);
    roomsService = module.get<RoomsService>(RoomsService);
    loggerService = module.get<LoggerService>(LoggerService);
    gateway.server = mockServer as Server;

    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('handleConnection', () => {
    it('should authenticate user and join their rooms', async () => {
      // Arrange
      jest.spyOn(authService, 'validateToken').mockResolvedValue(testUser1);
      jest.spyOn(roomsService, 'getUserRooms').mockResolvedValue([testRoom1, testRoom2]);

      // Act
      await gateway.handleConnection(mockSocket as Socket);

      // Assert
      expect(authService.validateToken).toHaveBeenCalledWith('valid-token');
      expect(mockSocket.data!.user).toEqual(testUser1);
      
      // Should join user's personal room and both chat rooms
      expect(mockSocket.join).toHaveBeenCalledTimes(3);
      expect(mockSocket.join).toHaveBeenCalledWith(`user:${testUser1.id}`);
      expect(mockSocket.join).toHaveBeenCalledWith('room:1');
      expect(mockSocket.join).toHaveBeenCalledWith('room:2');
      
      // Should emit presence update
      expect(mockServer.emit).toHaveBeenCalledWith('user_presence', {
        userId: 1,
        status: 'online',
      });
      
      // Verify logger was called
      expect(loggerService.debug).toHaveBeenCalled();
    });

    it('should disconnect if authorization header is missing', async () => {
      // Arrange
      const socketWithoutAuth = {
        ...mockSocket,
        handshake: {
          ...mockSocket.handshake,
          headers: {}
        }
      } as unknown as Socket;

      // Act
      await gateway.handleConnection(socketWithoutAuth);

      // Assert
      expect(socketWithoutAuth.disconnect).toHaveBeenCalled();
      expect(authService.validateToken).not.toHaveBeenCalled();
      
      // Verify logger was called
      expect(loggerService.warn).toHaveBeenCalled();
    });

    it('should disconnect if token is invalid', async () => {
      // Arrange
      jest.spyOn(authService, 'validateToken').mockResolvedValue(null);

      // Act
      await gateway.handleConnection(mockSocket as Socket);

      // Assert
      expect(mockSocket.disconnect).toHaveBeenCalled();
      
      // Verify logger was called
      expect(loggerService.warn).toHaveBeenCalled();
    });

    it('should disconnect if token validation throws an error', async () => {
      // Arrange
      jest.spyOn(authService, 'validateToken').mockRejectedValue(new Error('Invalid token'));

      // Act
      await gateway.handleConnection(mockSocket as Socket);

      // Assert
      expect(mockSocket.disconnect).toHaveBeenCalled();
      
      // Verify logger was called
      expect(loggerService.error).toHaveBeenCalled();
    });
  });

  describe('handleDisconnect', () => {
    it('should emit offline status when user disconnects', () => {
      // Arrange
      mockSocket.data = { user: testUser1 };

      // Act
      gateway.handleDisconnect(mockSocket as Socket);

      // Assert
      expect(mockServer.emit).toHaveBeenCalledWith('user_presence', {
        userId: 1,
        status: 'offline',
      });
    });

    it('should not emit anything if user data is missing', () => {
      // Arrange
      mockSocket.data = {};

      // Act
      gateway.handleDisconnect(mockSocket as Socket);

      // Assert
      expect(mockServer.emit).not.toHaveBeenCalled();
    });
  });

  describe('handleJoinRoom', () => {
    it('should allow user to join a room they have access to', async () => {
      // Arrange
      mockSocket.data = { user: testUser1 };
      jest.spyOn(roomsService, 'canUserJoinRoom').mockResolvedValue(true);

      // Act
      const result = await gateway.handleJoinRoom(mockSocket as Socket, { roomId: testRoom1.id });

      // Assert
      expect(roomsService.canUserJoinRoom).toHaveBeenCalledWith({userId: testUser1.id, roomId: testRoom1.id});
      expect(mockSocket.join).toHaveBeenCalledWith(`room:${testRoom1.id}`);
      expect(roomsService.updateLastSeen).toHaveBeenCalledWith(testUser1.id, testRoom1.id);
      expect(result).toEqual({ success: true });
    });

    it('should return error if user does not have access to the room', async () => {
      // Arrange
      mockSocket.data = { user: testUser1 };
      jest.spyOn(roomsService, 'canUserJoinRoom').mockResolvedValue(false);

      // Act
      const result = await gateway.handleJoinRoom(mockSocket as Socket, { roomId: testRoom1.id });

      // Assert
      expect(result).toEqual({ error: '접근 권한이 없습니다' });
      expect(mockSocket.join).not.toHaveBeenCalled();
      expect(roomsService.updateLastSeen).not.toHaveBeenCalled();
    });
  });

  describe('handleNewMessage', () => {
    it('should create and broadcast a new message', async () => {
      // Arrange
      mockSocket.data = { user: testUser1 };
      jest.spyOn(roomsService, 'canUserJoinRoom').mockResolvedValue(true);
      jest.spyOn(messagesService, 'createMessage').mockResolvedValue(testMessageResponse as MessageResponseDto);

      const createMessageDto: CreateMessageDto = {
        content: 'Test message content',
        roomId: testRoom1.id,
      };

      // Act
      const result = await gateway.handleNewMessage(mockSocket as Socket, createMessageDto);

      // Assert
      expect(roomsService.canUserJoinRoom).toHaveBeenCalledWith({userId: testUser1.id, roomId: testRoom1.id});
      expect(messagesService.createMessage).toHaveBeenCalledWith({
        content: 'Test message content',
        roomId: testRoom1.id,
        senderId: testUser1.id,
        parentId: undefined,
      });
      
      expect(mockServer.to).toHaveBeenCalledWith(`room:${testRoom1.id}`);
      expect(mockServer.to!(`room:${testRoom1.id}`).emit).toHaveBeenCalledWith(
        'new_message',
        testMessageResponse
      );
      
      expect(result).toBe(testMessageResponse);
    });

    it('should handle message with mentions and notify mentioned users', async () => {
      // Arrange
      mockSocket.data = { user: testUser1 };
      jest.spyOn(roomsService, 'canUserJoinRoom').mockResolvedValue(true);
      
      const messageWithMentions = {
        ...testMessageResponse,
        content: 'Hey @TestUser2, check this out!',
        mentions: [
          { mentionedUser: { id: testUser2.id, nickname: 'TestUser2' } }
        ]
      };
      
      jest.spyOn(messagesService, 'createMessage').mockResolvedValue(messageWithMentions as MessageResponseDto);

      // Act
      const result = await gateway.handleNewMessage(mockSocket as Socket, {
        content: 'Hey @TestUser2, check this out!',
        roomId: testRoom1.id,
      });

      // Assert
      expect(messagesService.createMessage).toHaveBeenCalledWith({
        content: 'Hey @TestUser2, check this out!',
        roomId: testRoom1.id,
        senderId: testUser1.id,
        parentId: undefined,
      });
      
      // Should notify the mentioned user
      expect(mockServer.to).toHaveBeenCalledWith(`user:${testUser2.id}`);
      expect(mockServer.to!(`user:${testUser2.id}`).emit).toHaveBeenCalledWith(
        'mention_alert',
        { messageId: messageWithMentions.id, roomId: testRoom1.id }
      );
    });

    it('should return error if user has no access to the room', async () => {
      // Arrange
      mockSocket.data = { user: testUser1 };
      jest.spyOn(roomsService, 'canUserJoinRoom').mockResolvedValue(false);

      // Act
      const result = await gateway.handleNewMessage(mockSocket as Socket, {
        content: 'This should fail',
        roomId: testRoom1.id,
      });

      // Assert
      expect(result).toEqual({ error: '접근 권한이 없습니다' });
      expect(messagesService.createMessage).not.toHaveBeenCalled();
      expect(mockServer.to).not.toHaveBeenCalled();
    });

    it('should handle service errors gracefully', async () => {
      // Arrange
      mockSocket.data = { user: testUser1 };
      jest.spyOn(roomsService, 'canUserJoinRoom').mockResolvedValue(true);
      jest.spyOn(messagesService, 'createMessage').mockRejectedValue(new Error('Database error'));

      // Act
      const result = await gateway.handleNewMessage(mockSocket as Socket, {
        content: 'This will cause an error',
        roomId: testRoom1.id,
      });

      // Assert
      expect(result).toEqual({ error: 'Database error' });
    });
  });

  describe('handleEditMessage', () => {
    it('should update and broadcast an edited message', async () => {
      // Arrange
      mockSocket.data = { user: testUser1 };
      
      // User can edit the message
      jest.spyOn(messagesService, 'canEditMessage').mockResolvedValue(true);
      
      const updatedMessage = {
        ...testMessageResponse,
        content: 'Updated content',
      };
      jest.spyOn(messagesService, 'updateMessage').mockResolvedValue(updatedMessage as MessageResponseDto);
      
      // Need the room ID to broadcast
      jest.spyOn(messagesService, 'getMessage').mockResolvedValue({
        ...testMessageResponse,
        roomId: testRoom1.id,
      } as MessageResponseDto);

      // Act
      const result = await gateway.handleEditMessage(mockSocket as Socket, {
        messageId: testMessageResponse.id!,
        content: 'Updated content',
      });

      // Assert
      expect(messagesService.canEditMessage).toHaveBeenCalledWith(testUser1.id, testMessageResponse.id);
      expect(messagesService.updateMessage).toHaveBeenCalledWith(
        testMessageResponse.id,
        testUser1.id,
        expect.objectContaining({ content: 'Updated content' })
      );
      
      expect(mockServer.to).toHaveBeenCalledWith(`room:${testRoom1.id}`);
      expect(mockServer.to!(`room:${testRoom1.id}`).emit).toHaveBeenCalledWith(
        'message_updated',
        updatedMessage
      );
      
      // Type check the result
      if ('error' in result) {
        fail('Expected success result but got error');
      } else {
        expect(result.content).toBe('Updated content');
      }
    });

    it('should return error if user cannot edit the message', async () => {
      // Arrange
      mockSocket.data = { user: testUser1 };
      jest.spyOn(messagesService, 'canEditMessage').mockResolvedValue(false);

      // Act
      const result = await gateway.handleEditMessage(mockSocket as Socket, {
        messageId: testMessageResponse.id!,
        content: 'This should fail',
      });

      // Assert
      expect(result).toEqual({ error: '메시지를 수정할 권한이 없습니다' });
      expect(messagesService.updateMessage).not.toHaveBeenCalled();
      expect(mockServer.to).not.toHaveBeenCalled();
    });

    it('should handle service errors gracefully', async () => {
      // Arrange
      mockSocket.data = { user: testUser1 };
      jest.spyOn(messagesService, 'canEditMessage').mockResolvedValue(true);
      jest.spyOn(messagesService, 'updateMessage').mockRejectedValue(new Error('Update failed'));

      // Act
      const result = await gateway.handleEditMessage(mockSocket as Socket, {
        messageId: testMessageResponse.id!,
        content: 'This will cause an error',
      });

      // Assert
      expect(result).toEqual({ error: 'Update failed' });
    });
  });

  describe('handleReaction', () => {
    it('should add a reaction and broadcast it', async () => {
      // Arrange
      mockSocket.data = { user: testUser1 };
      jest.spyOn(messagesService, 'toggleReaction').mockResolvedValue(testReaction as unknown as MessageReactionResponseDto);
      
      // Need message to get room ID
      const messageWithReactionDto = {
        ...testMessageResponse,
        roomId: testRoom1.id,
        reactions: [testReactionResponseDto],
      };
      jest.spyOn(messagesService, 'getMessage').mockResolvedValue(messageWithReactionDto as MessageResponseDto);

      const reactionDto: ReactionDto = {
        messageId: testMessageResponse.id!,
        emoji: '👍',
      };

      // Act
      const result = await gateway.handleReaction(mockSocket as Socket, reactionDto);

      // Assert
      expect(messagesService.toggleReaction).toHaveBeenCalledWith(
        testMessageResponse.id,
        testUser1.id,
        '👍'
      );
      
      expect(mockServer.to).toHaveBeenCalledWith(`room:${testRoom1.id}`);
      expect(mockServer.to!(`room:${testRoom1.id}`).emit).toHaveBeenCalledWith(
        'reaction_updated',
        {
          messageId: testMessageResponse.id,
          reactions: [testReactionResponseDto],
        }
      );
      
      expect(result).toEqual({
        success: true,
        added: true,
        reaction: testReaction,
      });
    });

    it('should handle removing a reaction', async () => {
      // Arrange
      mockSocket.data = { user: testUser1 };
      
      // Reaction will be removed (null returned)
      jest.spyOn(messagesService, 'toggleReaction').mockResolvedValue(null);
      
      // Need message to get room ID
      const messageWithoutReactions = {
        ...testMessageResponse,
        roomId: testRoom1.id,
        reactions: [], // No reactions after removal
      };
      jest.spyOn(messagesService, 'getMessage').mockResolvedValue(messageWithoutReactions as MessageResponseDto);

      // Act
      const result = await gateway.handleReaction(mockSocket as Socket, {
        messageId: testMessageResponse.id!,
        emoji: '👍',
      });

      // Assert
      expect(messagesService.toggleReaction).toHaveBeenCalledWith(
        testMessageResponse.id,
        testUser1.id,
        '👍'
      );
      
      expect(result).toEqual({
        success: true,
        added: false,
        reaction: null,
      });
    });

    it('should handle service errors gracefully', async () => {
      // Arrange
      mockSocket.data = { user: testUser1 };
      jest.spyOn(messagesService, 'toggleReaction').mockRejectedValue(new Error('Reaction failed'));

      // Act
      const result = await gateway.handleReaction(mockSocket as Socket, {
        messageId: testMessageResponse.id!,
        emoji: '👍',
      });

      // Assert
      expect(result).toEqual({ error: 'Reaction failed' });
    });
  });

  describe('handleReplyMessage', () => {
    it('should create and broadcast a reply to a message', async () => {
      // Arrange
      mockSocket.data = { user: testUser1 };
      jest.spyOn(roomsService, 'canUserJoinRoom').mockResolvedValue(true);
      
      // Mock parent message
      const parentMessage = {
        ...testMessageResponse,
        id: 10,
        sender: testUser2,
        roomId: testRoom1.id
      } as MessageResponseDto;
      
      jest.spyOn(messagesService, 'getMessage').mockResolvedValue(parentMessage);
      
      // Mock the reply
      const replyMessage = {
        ...testMessageResponse,
        id: 20,
        content: 'This is a reply',
        parentId: 10,
        roomId: testRoom1.id
      } as MessageResponseDto;
      
      jest.spyOn(messagesService, 'createMessage').mockResolvedValue(replyMessage);

      // Act
      const result = await gateway.handleReplyMessage(mockSocket as Socket, {
        roomId: testRoom1.id,
        parentId: 10,
        content: 'This is a reply'
      });

      // Assert
      expect(roomsService.canUserJoinRoom).toHaveBeenCalledWith({userId: testUser1.id, roomId: testRoom1.id});
      expect(messagesService.getMessage).toHaveBeenCalledWith(10);
      expect(messagesService.createMessage).toHaveBeenCalledWith({
        roomId: testRoom1.id,
        senderId: testUser1.id,
        content: 'This is a reply',
        parentId: 10
      });
      
      // Should broadcast the message to the room
      expect(mockServer.to).toHaveBeenCalledWith(`room:${testRoom1.id}`);
      expect(mockServer.to!(`room:${testRoom1.id}`).emit).toHaveBeenCalledWith('new_message', replyMessage);
      
      // Should notify the original message author
      expect(mockServer.to).toHaveBeenCalledWith(`user:${testUser2.id}`);
      expect(mockServer.to!(`user:${testUser2.id}`).emit).toHaveBeenCalledWith(
        'reply_alert',
        {
          messageId: replyMessage.id,
          parentId: 10,
          roomId: testRoom1.id
        }
      );
      
      expect(result).toBe(replyMessage);
    });

    it('should not send notification when replying to own message', async () => {
      // Arrange
      mockSocket.data = { user: testUser1 };
      jest.spyOn(roomsService, 'canUserJoinRoom').mockResolvedValue(true);
      
      // Mock parent message (from the same user)
      const parentMessage = {
        ...testMessageResponse,
        id: 10,
        sender: testUser1, // Same as the socket user
        roomId: testRoom1.id
      } as MessageResponseDto;
      
      jest.spyOn(messagesService, 'getMessage').mockResolvedValue(parentMessage);
      
      // Mock the reply
      const replyMessage = {
        ...testMessageResponse,
        id: 20,
        content: 'This is a reply to my own message',
        parentId: 10,
        roomId: testRoom1.id
      } as MessageResponseDto;
      
      jest.spyOn(messagesService, 'createMessage').mockResolvedValue(replyMessage);

      // Act
      const result = await gateway.handleReplyMessage(mockSocket as Socket, {
        roomId: testRoom1.id,
        parentId: 10,
        content: 'This is a reply to my own message'
      });

      // Assert
      expect(messagesService.createMessage).toHaveBeenCalled();
      
      // Should broadcast the message to the room
      expect(mockServer.to).toHaveBeenCalledWith(`room:${testRoom1.id}`);
      expect(mockServer.to!(`room:${testRoom1.id}`).emit).toHaveBeenCalledWith('new_message', replyMessage);
      
      // Should NOT send reply_alert to self
      const toUserCalls = jest.mocked(mockServer.to!).mock.calls.filter(
        call => call[0] === `user:${testUser1.id}`
      );
      expect(toUserCalls.length).toBe(0);
      
      expect(result).toBe(replyMessage);
    });

    it('should return error if parent message does not exist', async () => {
      // Arrange
      mockSocket.data = { user: testUser1 };
      jest.spyOn(roomsService, 'canUserJoinRoom').mockResolvedValue(true);
      jest.spyOn(messagesService, 'getMessage').mockResolvedValue(null);

      // Act
      const result = await gateway.handleReplyMessage(mockSocket as Socket, {
        roomId: testRoom1.id,
        parentId: 999,
        content: 'This should fail'
      });

      // Assert
      expect(result).toEqual({ error: '답장할 메시지를 찾을 수 없습니다' });
      expect(messagesService.createMessage).not.toHaveBeenCalled();
    });

    it('should return error if parent message is in a different room', async () => {
      // Arrange
      mockSocket.data = { user: testUser1 };
      jest.spyOn(roomsService, 'canUserJoinRoom').mockResolvedValue(true);
      
      // Mock parent message in a different room
      const parentMessage = {
        ...testMessageResponse,
        id: 10,
        roomId: 999 // Different from the requested room
      } as MessageResponseDto;
      
      jest.spyOn(messagesService, 'getMessage').mockResolvedValue(parentMessage);

      // Act
      const result = await gateway.handleReplyMessage(mockSocket as Socket, {
        roomId: testRoom1.id,
        parentId: 10,
        content: 'This should fail'
      });

      // Assert
      expect(result).toEqual({ error: '잘못된 요청입니다' });
      expect(messagesService.createMessage).not.toHaveBeenCalled();
    });

    it('should return error if user has no access to the room', async () => {
      // Arrange
      mockSocket.data = { user: testUser1 };
      jest.spyOn(roomsService, 'canUserJoinRoom').mockResolvedValue(false);

      // Act
      const result = await gateway.handleReplyMessage(mockSocket as Socket, {
        roomId: testRoom1.id,
        parentId: 10,
        content: 'This should fail'
      });

      // Assert
      expect(result).toEqual({ error: '접근 권한이 없습니다' });
      expect(messagesService.getMessage).not.toHaveBeenCalled();
      expect(messagesService.createMessage).not.toHaveBeenCalled();
    });

    it('should handle service errors gracefully', async () => {
      // Arrange
      mockSocket.data = { user: testUser1 };
      jest.spyOn(roomsService, 'canUserJoinRoom').mockResolvedValue(true);
      
      // Mock parent message
      const parentMessage = {
        ...testMessageResponse,
        id: 10,
        roomId: testRoom1.id
      } as MessageResponseDto;
      
      jest.spyOn(messagesService, 'getMessage').mockResolvedValue(parentMessage);
      jest.spyOn(messagesService, 'createMessage').mockRejectedValue(new Error('Database error'));

      // Act
      const result = await gateway.handleReplyMessage(mockSocket as Socket, {
        roomId: testRoom1.id,
        parentId: 10,
        content: 'This will cause an error'
      });

      // Assert
      expect(result).toEqual({ error: 'Database error' });
    });
  });
}); 