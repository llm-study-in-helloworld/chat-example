import { RoomRole } from '@chat-example/types';
import { EntityManager, MikroORM } from '@mikro-orm/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/postgresql';
import { Test, TestingModule } from '@nestjs/testing';
import bcrypt from 'bcrypt';
import { Room, RoomUser, User } from '../../src/entities';
import { RoomsService } from '../../src/rooms/rooms.service';
import testConfig from '../mikro-orm.config.test';

describe('RoomsService', () => {
  let service: RoomsService;
  let orm: MikroORM;
  let em: EntityManager;
  let roomRepository: EntityRepository<Room>;
  let roomUserRepository: EntityRepository<RoomUser>;
  let userRepository: EntityRepository<User>;

  // Test data
  let testUser1: User;
  let testUser2: User;
  let testRoom: Room;
  let testRoomUser1: RoomUser;
  let testRoomUser2: RoomUser;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        MikroOrmModule.forRoot(testConfig),
        MikroOrmModule.forFeature({
          entities: [User, Room, RoomUser]
        }),
      ],
      providers: [RoomsService],
    }).compile();

    service = module.get<RoomsService>(RoomsService);
    orm = module.get<MikroORM>(MikroORM);
    em = module.get<EntityManager>(EntityManager);
    roomRepository = em.getRepository(Room);
    roomUserRepository = em.getRepository(RoomUser);
    userRepository = em.getRepository(User);

    // Create schema
    await orm.getSchemaGenerator().createSchema();
  });

  beforeEach(async () => {
    // Clear database before each test
    await orm.getSchemaGenerator().refreshDatabase();

    // Create test users
    testUser1 = new User();
    testUser1.email = 'test1@example.com';
    testUser1.nickname = 'TestUser1';
    testUser1.imageUrl = 'http://example.com/avatar1.jpg';
    testUser1.passwordHash = await bcrypt.hash('password1', 10);

    testUser2 = new User();
    testUser2.email = 'test2@example.com';
    testUser2.nickname = 'TestUser2';
    testUser2.imageUrl = 'http://example.com/avatar2.jpg';
    testUser2.passwordHash = await bcrypt.hash('password2', 10);

    await em.persistAndFlush([testUser1, testUser2]);

    // Create a test room
    testRoom = new Room();
    testRoom.name = 'Test Room';
    testRoom.isDirect = false;
    testRoom.isPrivate = false;
    testRoom.isActive = true;
    testRoom.ownerId = testUser1.id;
    await em.persistAndFlush(testRoom);

    // Create room-user relationships
    testRoomUser1 = new RoomUser();
    testRoomUser1.room = testRoom;
    testRoomUser1.user = testUser1;
    testRoomUser1.joinedAt = new Date();
    testRoomUser1.lastSeenAt = new Date();
    testRoomUser1.role = RoomRole.OWNER;

    testRoomUser2 = new RoomUser();
    testRoomUser2.room = testRoom;
    testRoomUser2.user = testUser2;
    testRoomUser2.joinedAt = new Date();
    testRoomUser2.lastSeenAt = new Date();
    testRoomUser2.role = RoomRole.MEMBER;

    await em.persistAndFlush([testRoomUser1, testRoomUser2]);

    // Clear EntityManager to ensure fresh state for each test
    em.clear();
  });

  afterAll(async () => {
    await orm.close();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUserRooms', () => {
    it('should return rooms for a user', async () => {
      // Act
      const rooms = await service.getUserRooms(testUser1.id);

      // Assert
      expect(rooms).toBeDefined();
      expect(Array.isArray(rooms)).toBe(true);
      expect(rooms.length).toBe(1);
      expect(rooms[0].id).toBe(testRoom.id);
      expect(rooms[0].name).toBe(testRoom.name);
    });

    it('should return empty array for user with no rooms', async () => {
      // Arrange
      const newUser = new User();
      newUser.email = 'norooms@example.com';
      newUser.nickname = 'NoRooms';
      newUser.passwordHash = await bcrypt.hash('password', 10);
      await em.persistAndFlush(newUser);
      em.clear();

      // Act
      const rooms = await service.getUserRooms(newUser.id);

      // Assert
      expect(rooms).toBeDefined();
      expect(Array.isArray(rooms)).toBe(true);
      expect(rooms.length).toBe(0);
    });
  });

  describe('createRoom', () => {
    it('should create a new room with users', async () => {
      // Act
      const roomName = 'New Test Room';
      const isDirect = false;
      const userIds = [testUser1.id, testUser2.id];
      
      const result = await service.createRoom(roomName, isDirect, userIds, testUser1.id);

      // Assert
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
      expect(result[0].id).toBeDefined();
      expect(result[0].name).toBe(roomName);
      expect(result[0].isDirect).toBe(isDirect);

      // Verify room users were created
      const roomId = result[0].id;
      const roomUsers = await roomUserRepository.find({ room: { id: roomId } }, { populate: ['user'] });
      expect(roomUsers.length).toBe(2);
      
      const roomUserIds = roomUsers.map(ru => ru.user.id);
      expect(roomUserIds).toContain(testUser1.id);
      expect(roomUserIds).toContain(testUser2.id);
    });

    it('should create a direct message room without name', async () => {
      // Act
      const isDirect = true;
      const userIds = [testUser1.id, testUser2.id];
      
      const result = await service.createRoom(undefined, isDirect, userIds, testUser1.id);

      // Assert
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
      expect(result[0].id).toBeDefined();
      expect(result[0].name).toBe('');
      expect(result[0].isDirect).toBe(true);

      // Verify room users were created
      const roomId = result[0].id;
      const roomUsers = await roomUserRepository.find({ room: { id: roomId } });
      expect(roomUsers.length).toBe(2);
    });

    it('should throw error if no users provided', async () => {
      // Act & Assert
      await expect(service.createRoom('Empty Room', false, [], testUser1.id))
        .rejects.toThrow('At least one user is required to create a room');
    });
  });

  describe('getRoomById', () => {
    it('should return a room by id', async () => {
      // Act
      const room = await service.getRoomById(testRoom.id);

      // Assert
      expect(room).toBeDefined();
      expect(room!.id).toBe(testRoom.id);
      expect(room!.name).toBe(testRoom.name);
    });
    
    it('should return null if room not found', async () => {
      // Act
      const room = await service.getRoomById(999);

      // Assert
      expect(room).toBeNull();
    });
  });

  describe('getRoomUsers', () => {
    it('should return users in a room', async () => {
      // Act
      const users = await service.getRoomUsers(testRoom.id);

      // Assert
      expect(users).toBeDefined();
      expect(Array.isArray(users)).toBe(true);
      expect(users.length).toBe(2);
      
      const userIds = users.map(u => u.userId);
      expect(userIds).toContain(testUser1.id);
      expect(userIds).toContain(testUser2.id);
    });
  });

  describe('addUserToRoom', () => {
    it('should add a user to a room', async () => {
      // Arrange
      const newUser = new User();
      newUser.email = 'newuser@example.com';
      newUser.nickname = 'NewUser';
      newUser.passwordHash = await bcrypt.hash('password', 10);
      await em.persistAndFlush(newUser);
      em.clear();

      // Act
      const roomUser = await service.addUserToRoom(testRoom.id, newUser.id);

      // Assert
      expect(roomUser).toBeDefined();
      expect(roomUser.room.id).toBe(testRoom.id);
      expect(roomUser.user.id).toBe(newUser.id);
      
      // Verify in database
      const verifyRoomUser = await roomUserRepository.findOne(
        { room: { id: testRoom.id }, user: { id: newUser.id } },
        { populate: ['room', 'user'] }
      );
      expect(verifyRoomUser).toBeDefined();
      expect(verifyRoomUser!.joinedAt).toBeDefined();
    });
    
    it('should return existing roomUser if user already in room', async () => {
      // Act
      const roomUser = await service.addUserToRoom(testRoom.id, testUser1.id);

      // Assert
      expect(roomUser).toBeDefined();
      expect(roomUser.room.id).toBe(testRoom.id);
      expect(roomUser.user.id).toBe(testUser1.id);
    });
  });

  describe('removeUserFromRoom', () => {
    it('should remove a user from a room', async () => {
      // Act
      const result = await service.removeUserFromRoom(testRoom.id, testUser1.id);

      // Assert
      expect(result).toBe(true);
      
      // Verify user was removed from room
      const verifyRoomUser = await roomUserRepository.findOne(
        { room: { id: testRoom.id }, user: { id: testUser1.id } }
      );
      expect(verifyRoomUser).toBeNull();
    });
    
    it('should return false if user not in room', async () => {
      // Arrange
      const newUser = new User();
      newUser.email = 'notinroom@example.com';
      newUser.nickname = 'NotInRoom';
      newUser.passwordHash = await bcrypt.hash('password', 10);
      await em.persistAndFlush(newUser);
      em.clear();

      // Act
      const result = await service.removeUserFromRoom(testRoom.id, newUser.id);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('canUserJoinRoom', () => {
    it('should return true if user is already in the room', async () => {
      // Act
      const result = await service.canUserJoinRoom(testUser1.id, testRoom.id);

      // Assert
      expect(result).toBe(true);
    });
    
    it('should return false if room does not exist', async () => {
      // Act
      const result = await service.canUserJoinRoom(testUser1.id, 999);

      // Assert
      expect(result).toBe(false);
    });
    
    it('should return false if user is not in a private room', async () => {
      // Arrange
      const newUser = new User();
      newUser.email = 'cantjoin@example.com';
      newUser.nickname = 'CantJoin';
      newUser.passwordHash = await bcrypt.hash('password', 10);
      await em.persistAndFlush(newUser);
      
      const privateRoom = new Room();
      privateRoom.name = 'Private Room';
      privateRoom.isDirect = false;
      privateRoom.isPrivate = true;
      privateRoom.isActive = true;
      privateRoom.ownerId = testUser1.id;
      await em.persistAndFlush(privateRoom);
      
      em.clear();

      // Act
      const result = await service.canUserJoinRoom(newUser.id, privateRoom.id);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('isUserInRoom', () => {
    it('should return true if user is in the room', async () => {
      // Act
      const result = await service.isUserInRoom(testUser1.id, testRoom.id);

      // Assert
      expect(result).toBe(true);
    });
    
    it('should return false if user is not in the room', async () => {
      // Arrange
      const newUser = new User();
      newUser.email = 'notinroom@example.com';
      newUser.nickname = 'NotInRoom';
      newUser.passwordHash = await bcrypt.hash('password', 10);
      await em.persistAndFlush(newUser);
      em.clear();

      // Act
      const result = await service.isUserInRoom(newUser.id, testRoom.id);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('updateLastSeen', () => {
    it('should update the lastSeenAt timestamp', async () => {
      // Arrange
      const originalRoomUser = await roomUserRepository.findOne(
        { room: { id: testRoom.id }, user: { id: testUser1.id } }
      );
      const originalLastSeen = originalRoomUser!.lastSeenAt;
      
      // Wait a bit to ensure timestamp differs
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Act
      await service.updateLastSeen(testUser1.id, testRoom.id);
      
      // Assert
      const updatedRoomUser = await roomUserRepository.findOne(
        { room: { id: testRoom.id }, user: { id: testUser1.id } }
      );
      expect(updatedRoomUser!.lastSeenAt).not.toEqual(originalLastSeen);
    });
    
    it('should do nothing if roomUser not found', async () => {
      // Arrange
      const newUser = new User();
      newUser.email = 'notinroom2@example.com';
      newUser.nickname = 'NotInRoom2';
      newUser.passwordHash = await bcrypt.hash('password', 10);
      await em.persistAndFlush(newUser);
      em.clear();

      // Act - Should not throw
      await service.updateLastSeen(newUser.id, testRoom.id);
      
      // Assert - Nothing to assert, just checking it doesn't throw
    });
  });
}); 