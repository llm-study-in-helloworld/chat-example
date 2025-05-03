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
    testRoom.isGroup = true;
    await em.persistAndFlush(testRoom);

    // Create room-user relationships
    testRoomUser1 = new RoomUser();
    testRoomUser1.room = testRoom;
    testRoomUser1.user = testUser1;
    testRoomUser1.joinedAt = new Date();
    testRoomUser1.lastSeenAt = new Date();

    testRoomUser2 = new RoomUser();
    testRoomUser2.room = testRoom;
    testRoomUser2.user = testUser2;
    testRoomUser2.joinedAt = new Date();
    testRoomUser2.lastSeenAt = new Date();

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
      const isGroup = true;
      const userIds = [testUser1.id, testUser2.id];
      
      const newRoom = await service.createRoom(roomName, isGroup, userIds);

      // Assert
      expect(newRoom).toBeDefined();
      expect(newRoom.id).toBeDefined();
      expect(newRoom.name).toBe(roomName);
      expect(newRoom.isGroup).toBe(isGroup);

      // Verify room users were created
      const roomUsers = await roomUserRepository.find({ room: { id: newRoom.id } }, { populate: ['user'] });
      expect(roomUsers.length).toBe(2);
      
      const roomUserIds = roomUsers.map(ru => ru.user.id);
      expect(roomUserIds).toContain(testUser1.id);
      expect(roomUserIds).toContain(testUser2.id);
    });

    it('should create a direct message room without name', async () => {
      // Act
      const isGroup = false;
      const userIds = [testUser1.id, testUser2.id];
      
      const newRoom = await service.createRoom(undefined, isGroup, userIds);

      // Assert
      expect(newRoom).toBeDefined();
      expect(newRoom.id).toBeDefined();
      expect(newRoom.name).toBeUndefined();
      expect(newRoom.isGroup).toBe(false);

      // Verify room users were created
      const roomUsers = await roomUserRepository.find({ room: { id: newRoom.id } });
      expect(roomUsers.length).toBe(2);
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
      
      const userIds = users.map(u => u.id);
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
    it('should return true if user can join room', async () => {
      // Act
      const result = await service.canUserJoinRoom(testUser1.id, testRoom.id);

      // Assert
      expect(result).toBe(true);
    });
    
    it('should return false if user cannot join room', async () => {
      // Arrange
      const newUser = new User();
      newUser.email = 'cantjoin@example.com';
      newUser.nickname = 'CantJoin';
      newUser.passwordHash = await bcrypt.hash('password', 10);
      await em.persistAndFlush(newUser);
      em.clear();

      // Act
      const result = await service.canUserJoinRoom(newUser.id, testRoom.id);

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

  describe('formatRoomResponse', () => {
    it('should format rooms as DTOs', async () => {
      // Act
      const roomDtos = await service.formatRoomResponse([testRoom]);

      // Assert
      expect(roomDtos).toBeDefined();
      expect(Array.isArray(roomDtos)).toBe(true);
      expect(roomDtos.length).toBe(1);
      
      const roomDto = roomDtos[0];
      expect(roomDto.id).toBe(testRoom.id);
      expect(roomDto.name).toBe(testRoom.name);
      expect(roomDto.isGroup).toBe(testRoom.isGroup);
      expect(roomDto.createdAt).toBeDefined();
      expect(roomDto.updatedAt).toBeDefined();
      
      // Check users are included
      expect(Array.isArray(roomDto.users)).toBe(true);
      expect(roomDto.users.length).toBe(2);
      
      const userIds = roomDto.users.map(u => u.id);
      expect(userIds).toContain(testUser1.id);
      expect(userIds).toContain(testUser2.id);
    });
  });
}); 