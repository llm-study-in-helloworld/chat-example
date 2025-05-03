import { EntityManager, MikroORM } from '@mikro-orm/core';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { io, Socket } from 'socket.io-client';
import request from 'supertest';
import { MessageResponseDto } from '../../src/dto';
import { ReactionResponseDto, ReactionUpdateEventDto, SocketErrorDto, SocketSuccessDto, UserPresenceEventDto } from '../../src/gateway/dto/socket-response.dto';
import { CreateMessageDto } from '../../src/messages/dto/create-message.dto';
import { ReactionDto } from '../../src/messages/dto/reaction.dto';
import { AppTestModule } from '../app-test.module';
import { AccessTokensDict, TestUser, TestUserResponse } from '../types/test-user.type';

// Define type for socket responses
type SocketResponse<T> = T | SocketErrorDto;

// Increase timeouts for test stability
jest.setTimeout(30000);

describe('ChatGateway (e2e)', () => {
  let app: INestApplication;
  let httpServer: any;
  let em: EntityManager;
  let orm: MikroORM;
  
  // Test users and their tokens
  const testUsers: TestUser[] = [];
  const accessTokens: AccessTokensDict = {};
  
  // Room ID to use for tests
  let roomId: number;
  
  // Socket clients
  const socketClients: { [key: string]: Socket } = {};
  
  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppTestModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    httpServer = createServer(app.getHttpServer());
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
    await app.listen(0); // random port for testing
    
    // Create test users
    for (let i = 1; i <= 3; i++) {
      const userData = await createTestUser(i);
      testUsers.push(userData.user);
      accessTokens[`user${i}`] = userData.token;
    }
    
    // Create a test room
    const roomResponse = await request(app.getHttpServer())
      .post('/api/rooms')
      .set('Authorization', `Bearer ${accessTokens['user1']}`)
      .send({
        name: 'WebSocket Test Room',
        isGroup: true,
        userIds: [testUsers[0].id, testUsers[1].id, testUsers[2].id]
      });
    
    roomId = roomResponse.body.id;
    
    // Create WebSocket connections for each user
    for (let i = 1; i <= 3; i++) {
      const socket = io(`http://localhost:${app.getHttpServer().address().port}`, {
        extraHeaders: {
          authorization: `Bearer ${accessTokens[`user${i}`]}`
        },
        transports: ['websocket'],
        autoConnect: false,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      });
      
      socketClients[`user${i}`] = socket;
    }
  });
  
  afterAll(async () => {
    // Clean up socket connections
    for (const clientKey in socketClients) {
      const socket = socketClients[clientKey];
      if (socket.connected) {
        socket.disconnect();
      }
    }
    
    await app.close();
    await orm.close();
  });
  
  // Helper function to create a test user
  const createTestUser = async (index: number): Promise<TestUserResponse> => {
    const uniqueId = `${index}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const userData = {
      email: `socket-test-${uniqueId}@example.com`,
      password: 'password123',
      nickname: `SocketTestUser${uniqueId}`
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
  
  // Helper function to wait for a specific event
  const waitForEvent = <T>(socket: Socket, event: string, timeout = 10000): Promise<T> => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for '${event}' event`));
      }, timeout);
      
      socket.once(event, (data: T) => {
        clearTimeout(timer);
        resolve(data);
      });
    });
  };
  
  // Helper function to emit and wait for a response
  const emitAndWait = <T>(socket: Socket, event: string, data: any, timeout = 10000): Promise<T> => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for response to '${event}'`));
      }, timeout);

      // Make sure socket is connected
      if (!socket.connected) {
        socket.connect();
      }

      // Wait for socket to be connected before emitting
      if (socket.connected) {
        socket.emit(event, data, (response: T) => {
          clearTimeout(timer);
          resolve(response);
        });
      } else {
        socket.once('connect', () => {
          socket.emit(event, data, (response: T) => {
            clearTimeout(timer);
            resolve(response);
          });
        });
      }
    });
  };

  // Helper function to ensure all sockets are connected
  const ensureAllSocketsConnected = async () => {
    for (const clientKey in socketClients) {
      const socket = socketClients[clientKey];
      if (!socket.connected) {
        const connectPromise = new Promise<void>((resolve) => {
          socket.once('connect', () => resolve());
        });
        socket.connect();
        await connectPromise;
      }
    }
  };
  
  describe('Connection Management', () => {
    it('should connect with valid token', async () => {
      // Given a user with valid token
      const userSocket = socketClients['user1'];
      
      // When they connect
      const connectPromise = new Promise<void>((resolve) => {
        if (userSocket.connected) {
          resolve();
          return;
        }
        userSocket.once('connect', () => {
          resolve();
        });
        userSocket.connect();
      });
      
      // Then they should establish a connection successfully
      await connectPromise;
      expect(userSocket.connected).toBe(true);
    });
    
    it('should disconnect with invalid token', async () => {
      // Given a socket with invalid token
      const invalidSocket = io(`http://localhost:${app.getHttpServer().address().port}`, {
        extraHeaders: {
          authorization: 'Bearer invalid-token'
        },
        transports: ['websocket'],
        autoConnect: false
      });
      
      // When they try to connect
      const disconnectPromise = new Promise<void>((resolve) => {
        invalidSocket.once('disconnect', () => {
          resolve();
        });
        invalidSocket.connect();
      });
      
      // Then they should be disconnected
      await disconnectPromise;
      expect(invalidSocket.connected).toBe(false);
      
      // Clean up
      invalidSocket.close();
    });
  });
  
  describe('Room Management', () => {
    beforeEach(async () => {
      // Ensure all sockets are connected
      await ensureAllSocketsConnected();
    });
    
    it('should allow joining a room with access permissions', async () => {
      // Given a user with access to a room
      const userSocket = socketClients['user1'];
      
      // When they attempt to join
      const response = await emitAndWait<SocketResponse<SocketSuccessDto>>(userSocket, 'join_room', { roomId });
      
      // Then they should join successfully
      expect(response).toEqual({ success: true });
    });
    
    it('should reject joining a room without permissions', async () => {
      // Create a new user not in the room
      const outsiderData = await createTestUser(99);
      const outsiderSocket = io(`http://localhost:${app.getHttpServer().address().port}`, {
        extraHeaders: {
          authorization: `Bearer ${outsiderData.token}`
        },
        transports: ['websocket'],
        autoConnect: false,
        reconnection: true,
        reconnectionAttempts: 5
      });
      
      try {
        // Ensure socket connects
        const connectPromise = new Promise<void>((resolve, reject) => {
          const connectTimeout = setTimeout(() => {
            reject(new Error('Connection timeout'));
          }, 5000);
          
          outsiderSocket.once('connect', () => {
            clearTimeout(connectTimeout);
            resolve();
          });
          
          outsiderSocket.connect();
        });
        
        await connectPromise;
        
        // Wait to ensure connection is fully established
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // When they attempt to join a room they don't have access to
        outsiderSocket.emit('join_room', { roomId }, (response: any) => {
          // Then they should receive an error
          expect(response).toHaveProperty('error');
          expect(response.error).toContain('접근 권한이 없습니다');
        });
        
        // Wait for the socket.io event to be processed
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } finally {
        if (outsiderSocket.connected) {
          outsiderSocket.disconnect();
        }
      }
    });
  });
  
  describe('Messaging', () => {
    // We'll now create messages within each test that needs one
    
    beforeEach(async () => {
      // Ensure all sockets are connected
      await ensureAllSocketsConnected();
      
      // Join all users to the test room
      for (const clientKey in socketClients) {
        await emitAndWait<SocketResponse<SocketSuccessDto>>(socketClients[clientKey], 'join_room', { roomId });
      }
    });
    
    it('should send and receive messages in a room', async () => {
      // Given a user in a room
      const senderSocket = socketClients['user1'];
      const receiverSocket = socketClients['user2'];
      
      // Set up listener for receiver
      const messagePromise = waitForEvent<MessageResponseDto>(receiverSocket, 'new_message');
      
      // When they send a message
      const message: CreateMessageDto = {
        roomId,
        content: 'Hello from WebSocket test!'
      };
      
      const response = await emitAndWait<MessageResponseDto>(senderSocket, 'new_message', message);
      
      // Then the message should be saved and broadcast to all room members
      expect(response).toBeDefined();
      expect(response.id).toBeDefined();
      expect(response.content).toBe(message.content);
      expect(response.sender).toBeDefined();
      expect(response.sender.id).toBe(testUsers[0].id);
      
      // And the other user in the room should receive it
      const receivedMessage = await messagePromise;
      expect(receivedMessage).toBeDefined();
      expect(receivedMessage.content).toBe(message.content);
      expect(receivedMessage.sender.id).toBe(testUsers[0].id);
    });
    
    it('should handle replies to messages', async () => {
      // Create a message to reply to first
      const senderSocket = socketClients['user1'];
      const message: CreateMessageDto = {
        roomId,
        content: 'Message for reply test'
      };
      
      const parentMessage = await emitAndWait<MessageResponseDto>(senderSocket, 'new_message', message);
      expect(parentMessage).toBeDefined();
      expect(parentMessage.id).toBeDefined();
      
      // Ensure sockets join their user-specific channels for receiving direct alerts
      await emitAndWait<SocketResponse<SocketSuccessDto>>(socketClients['user1'], 'join_room', { roomId });
      await emitAndWait<SocketResponse<SocketSuccessDto>>(socketClients['user2'], 'join_room', { roomId });
      
      // Wait for sockets to fully set up
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Set up reply test
      const replierSocket = socketClients['user2'];
      const originalSenderSocket = socketClients['user1'];
      
      // Set up listener for new message event
      const newMessagePromise = waitForEvent<MessageResponseDto>(originalSenderSocket, 'new_message');
      
      // Set up listener for reply alert event
      const replyAlertPromise = waitForEvent<{ messageId: number, parentId: number, roomId: number }>(
        originalSenderSocket, 
        'reply_alert',
        15000 // Increase timeout for reliability
      );
      
      // When a user replies to a message
      const replyData = {
        roomId,
        parentId: parentMessage.id,
        content: 'This is a reply through the reply_message event'
      };
      
      const response = await emitAndWait<MessageResponseDto>(replierSocket, 'reply_message', replyData);
      
      // Then the reply should be saved with the parent reference
      expect(response).toBeDefined();
      expect(response.id).toBeDefined();
      expect(response.content).toBe(replyData.content);
      expect(response.parentId).toBe(parentMessage.id);
      
      // And the original sender should receive the reply notification
      const receivedReply = await newMessagePromise;
      expect(receivedReply).toBeDefined();
      expect(receivedReply.content).toBe(replyData.content);
      expect(receivedReply.parentId).toBe(parentMessage.id);
      
      // And the original sender should also receive a reply alert
      const replyAlert = await replyAlertPromise;
      expect(replyAlert).toBeDefined();
      expect(replyAlert.messageId).toBe(response.id);
      expect(replyAlert.parentId).toBe(parentMessage.id);
      expect(replyAlert.roomId).toBe(roomId);
    });
    
    it('should handle replies to messages using new_message event', async () => {
      // Create a message to reply to first
      const senderSocket = socketClients['user1'];
      const message: CreateMessageDto = {
        roomId,
        content: 'Message for new_message reply test'
      };
      
      const parentMessage = await emitAndWait<MessageResponseDto>(senderSocket, 'new_message', message);
      expect(parentMessage).toBeDefined();
      expect(parentMessage.id).toBeDefined();
      
      // And users are in the room
      const replierSocket = socketClients['user2'];
      const originalSenderSocket = socketClients['user1'];
      
      // Set up listener for new message event
      const newMessagePromise = waitForEvent<MessageResponseDto>(originalSenderSocket, 'new_message');
      
      // When a user replies to a message
      const replyMessage: CreateMessageDto = {
        roomId,
        content: 'This is a reply to the original message',
        parentId: parentMessage.id
      };
      
      const response = await emitAndWait<MessageResponseDto>(replierSocket, 'new_message', replyMessage);
      
      // Then the reply should be saved with the parent reference
      expect(response).toBeDefined();
      expect(response.id).toBeDefined();
      expect(response.content).toBe(replyMessage.content);
      expect(response.parentId).toBe(parentMessage.id);
      
      // And the original sender should receive the reply notification
      const receivedReply = await newMessagePromise;
      expect(receivedReply).toBeDefined();
      expect(receivedReply.content).toBe(replyMessage.content);
      expect(receivedReply.parentId).toBe(parentMessage.id);
    });

    it('should reject replies to non-existent messages', async () => {
      // Given a non-existent message ID
      const nonExistentId = 999999;
      
      // When a user tries to reply to it
      const replierSocket = socketClients['user2'];
      
      const replyData = {
        roomId,
        parentId: nonExistentId,
        content: 'This reply should fail'
      };
      
      const response = await emitAndWait<SocketResponse<MessageResponseDto>>(
        replierSocket, 
        'reply_message', 
        replyData
      );
      
      // Then they should receive an error
      expect(response).toHaveProperty('error');
      expect((response as SocketErrorDto).error).toContain('답장할 메시지를 찾을 수 없습니다');
    });
    
    it('should edit messages', async () => {
      // Create a message to edit
      const senderSocket = socketClients['user1'];
      const message: CreateMessageDto = {
        roomId,
        content: 'Message for edit test'
      };
      
      const createdMessage = await emitAndWait<MessageResponseDto>(senderSocket, 'new_message', message);
      expect(createdMessage).toBeDefined();
      expect(createdMessage.id).toBeDefined();
      
      // And users are in the room
      const otherUserSocket = socketClients['user2'];
      
      // Set up listener for message updated event
      const updatePromise = waitForEvent<MessageResponseDto>(otherUserSocket, 'message_updated');
      
      // When the sender edits their message
      const editData = {
        messageId: createdMessage.id,
        content: 'This message has been edited via WebSocket'
      };
      
      const response = await emitAndWait<SocketResponse<MessageResponseDto>>(senderSocket, 'edit_message', editData);
      
      // Then the edit should be saved and broadcast
      expect(response).toBeDefined();
      
      if ('error' in response) {
        fail(`Expected success but got error: ${response.error}`);
      } else {
        expect(response.id).toBe(createdMessage.id);
        expect(response.content).toBe(editData.content);
      }
      
      // And other users should receive the update
      const updateEvent = await updatePromise;
      expect(updateEvent).toBeDefined();
      expect(updateEvent.id).toBe(createdMessage.id);
      expect(updateEvent.content).toBe(editData.content);
    });
    
    it('should prevent editing another user\'s message', async () => {
      // Create a message for the test
      const senderSocket = socketClients['user1'];
      const message: CreateMessageDto = {
        roomId,
        content: 'Message that should not be editable by others'
      };
      
      const createdMessage = await emitAndWait<MessageResponseDto>(senderSocket, 'new_message', message);
      expect(createdMessage).toBeDefined();
      expect(createdMessage.id).toBeDefined();
      
      // When another user tries to edit it
      const unauthorizedSocket = socketClients['user3'];
      
      const editData = {
        messageId: createdMessage.id,
        content: 'This edit should fail'
      };
      
      const response = await emitAndWait<SocketResponse<MessageResponseDto>>(unauthorizedSocket, 'edit_message', editData);
      
      // Then they should receive an error
      expect(response).toHaveProperty('error');
      expect((response as SocketErrorDto).error).toContain('권한이 없습니다');
    });
  });
  
  describe('Reactions', () => {
    // Create test message within each test
    
    beforeEach(async () => {
      // Ensure all sockets are connected
      await ensureAllSocketsConnected();
      
      // Join all users to the test room
      for (const clientKey in socketClients) {
        await emitAndWait<SocketResponse<SocketSuccessDto>>(socketClients[clientKey], 'join_room', { roomId });
      }
    });
    
    it('should add reactions to messages', async () => {
      // Create a message for reactions
      const message: CreateMessageDto = {
        roomId,
        content: 'Message for reaction test'
      };
      
      const createdMessage = await emitAndWait<MessageResponseDto>(
        socketClients['user1'], 
        'new_message', 
        message
      );
      
      expect(createdMessage).toBeDefined();
      expect(createdMessage.id).toBeDefined();
      
      // Set up listener for reaction events
      const reactionPromise = waitForEvent<ReactionUpdateEventDto>(socketClients['user1'], 'reaction_updated');
      
      // When a user reacts to a message
      const reactionData: ReactionDto = {
        messageId: createdMessage.id,
        emoji: '👍'
      };
      
      const response = await emitAndWait<ReactionResponseDto>(socketClients['user2'], 'react_message', reactionData);
      
      // Then the reaction should be saved
      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.added).toBe(true);
      expect(response.reaction).toBeDefined();
      expect(response.reaction?.emoji).toBe('👍');
      
      // And all users should receive the reaction update
      const reactionEvent = await reactionPromise;
      expect(reactionEvent).toBeDefined();
      expect(reactionEvent.messageId).toBe(createdMessage.id);
      expect(Array.isArray(reactionEvent.reactions)).toBe(true);
      expect(reactionEvent.reactions.length).toBeGreaterThan(0);
      expect(reactionEvent.reactions[0].emoji).toBe('👍');
    });
    
    it('should toggle reactions when the same user reacts twice', async () => {
      // Create a message for reactions
      const message: CreateMessageDto = {
        roomId,
        content: 'Message for reaction toggle test'
      };
      
      const createdMessage = await emitAndWait<MessageResponseDto>(
        socketClients['user1'], 
        'new_message', 
        message
      );
      
      expect(createdMessage).toBeDefined();
      expect(createdMessage.id).toBeDefined();
      
      // First add a reaction
      const reactorSocket = socketClients['user2'];
      const reactionData: ReactionDto = {
        messageId: createdMessage.id,
        emoji: '👍'
      };
      
      await emitAndWait<ReactionResponseDto>(reactorSocket, 'react_message', reactionData);
      
      // Set up listener for reaction update events
      const reactionPromise = waitForEvent<ReactionUpdateEventDto>(socketClients['user1'], 'reaction_updated');
      
      // When they react with the same emoji again
      const response = await emitAndWait<ReactionResponseDto>(reactorSocket, 'react_message', reactionData);
      
      // Then the reaction should be removed
      expect(response).toBeDefined();
      expect(response.success).toBe(true);
      expect(response.added).toBe(false); // Reaction was removed
      
      // And all users should receive the reaction update
      const reactionEvent = await reactionPromise as ReactionUpdateEventDto;
      expect(reactionEvent).toBeDefined();
      expect(reactionEvent.messageId).toBe(createdMessage.id);
      
      // The reactions array should no longer contain the removed reaction
      const thumbsUpReaction = reactionEvent.reactions.find(r => r.emoji === '👍' && r.userId === testUsers[1].id);
      expect(thumbsUpReaction).toBeUndefined();
    });
  });
  
  describe('User Presence', () => {
    it('should notify users when someone goes offline', async () => {
      // Ensure all sockets are connected
      await ensureAllSocketsConnected();
      
      // Set up presence event listener
      const presencePromise = waitForEvent<UserPresenceEventDto>(socketClients['user1'], 'user_presence');
      
      // When a user disconnects
      const disconnectingUserId = testUsers[1].id;
      socketClients['user2'].disconnect();
      
      // Then other users should receive a presence update
      const presenceUpdate = await presencePromise;
      expect(presenceUpdate).toBeDefined();
      expect(presenceUpdate.userId).toBe(disconnectingUserId);
      expect(presenceUpdate.status).toBe('offline');
    });
  });
}); 