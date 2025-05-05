import { EntityManager, MikroORM } from "@mikro-orm/core";
import { MikroOrmModule } from "@mikro-orm/nestjs";
import { EntityRepository } from "@mikro-orm/mysql";
import { Test, TestingModule } from "@nestjs/testing";
import bcrypt from "bcrypt";
import { Room, RoomUser, User } from "../../src/entities";
import { LoggerService } from "../../src/logger/logger.service";
import { RoomsService } from "../../src/rooms/rooms.service";
import testConfig from "../mikro-orm.config.test";
import { createMockLoggerService } from "./fixtures/logger.fixtures";
import { createRoomFixture, TestRoomData } from "./fixtures/room.fixtures";
import { createUserFixture, TestUserData } from "./fixtures/user.fixtures";

describe("RoomsService", () => {
  let service: RoomsService;
  let orm: MikroORM;
  let em: EntityManager;
  let roomRepository: EntityRepository<Room>;
  let roomUserRepository: EntityRepository<RoomUser>;
  let userRepository: EntityRepository<User>;
  let loggerService: LoggerService;

  // Test data
  let testUser1: User;
  let testUser2: User;
  let testUser1Data: TestUserData;
  let testUser2Data: TestUserData;
  let testRoom: Room;
  let testRoomData: TestRoomData;
  let testRoomUser1: RoomUser;
  let testRoomUser2: RoomUser;

  beforeAll(async () => {
    // Create mock logger service
    const mockLoggerService = createMockLoggerService();

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        MikroOrmModule.forRoot(testConfig),
        MikroOrmModule.forFeature({
          entities: [User, Room, RoomUser],
        }),
      ],
      providers: [
        RoomsService,
        {
          provide: LoggerService,
          useValue: mockLoggerService,
        },
      ],
    }).compile();

    service = module.get<RoomsService>(RoomsService);
    orm = module.get<MikroORM>(MikroORM);
    em = module.get<EntityManager>(EntityManager);
    roomRepository = em.getRepository(Room);
    roomUserRepository = em.getRepository(RoomUser);
    userRepository = em.getRepository(User);
    loggerService = module.get<LoggerService>(LoggerService);

    // Create schema
    await orm.getSchemaGenerator().createSchema();
  });

  beforeEach(async () => {
    // Clear database before each test
    await orm.getSchemaGenerator().refreshDatabase();

    // Create test users using fixtures
    testUser1Data = await createUserFixture(em, {
      email: "test1@example.com",
      nickname: "TestUser1",
      password: "password1",
      imageUrl: "http://example.com/avatar1.jpg",
    });

    testUser2Data = await createUserFixture(em, {
      email: "test2@example.com",
      nickname: "TestUser2",
      password: "password2",
      imageUrl: "http://example.com/avatar2.jpg",
    });

    // Get the actual user entities for tests that need them
    testUser1 = await userRepository.findOneOrFail({ id: testUser1Data.id });
    testUser2 = await userRepository.findOneOrFail({ id: testUser2Data.id });

    // Create a test room using fixture
    testRoomData = await createRoomFixture(em, testUser1Data, [testUser2Data], {
      name: "Test Room",
      isPrivate: false,
    });

    // Get the actual room entity and room user entities for tests that need them
    testRoom = await roomRepository.findOneOrFail({ id: testRoomData.id });
    testRoomUser1 = await roomUserRepository.findOneOrFail({
      room: { id: testRoomData.id },
      user: { id: testUser1Data.id },
    });
    testRoomUser2 = await roomUserRepository.findOneOrFail({
      room: { id: testRoomData.id },
      user: { id: testUser2Data.id },
    });

    // Reset mocks
    jest.clearAllMocks();

    // Clear EntityManager to ensure fresh state for each test
    em.clear();
  });

  afterAll(async () => {
    await orm.close();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("getUserRooms", () => {
    it("should return rooms for a user", async () => {
      // Act
      const rooms = await service.getUserRooms(testUser1.id);

      // Assert
      expect(rooms).toBeDefined();
      expect(Array.isArray(rooms)).toBe(true);
      expect(rooms.length).toBe(1);
      expect(rooms[0].id).toBe(testRoom.id);
      expect(rooms[0].name).toBe(testRoom.name);
    });

    it("should return empty array for user with no rooms", async () => {
      // Arrange
      const newUser = new User();
      newUser.email = "norooms@example.com";
      newUser.nickname = "NoRooms";
      newUser.passwordHash = await bcrypt.hash("password", 10);
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

  describe("createRoom", () => {
    it("should create a new room with users", async () => {
      // Act
      const roomName = "New Test Room";
      const isDirect = false;
      const userIds = [testUser1.id, testUser2.id];

      const result = await service.createRoom({
        name: roomName,
        isDirect,
        userIds,
        ownerId: testUser1.id,
        isPrivate: false,
      });

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.name).toBe(roomName);
      expect(result.isDirect).toBe(isDirect);

      // Verify room users were created
      const roomId = result.id;
      const roomUsers = await roomUserRepository.find(
        { room: { id: roomId } },
        { populate: ["user"] },
      );
      expect(roomUsers.length).toBe(2);

      const roomUserIds = roomUsers.map((ru) => ru.user.id);
      expect(roomUserIds).toContain(testUser1.id);
      expect(roomUserIds).toContain(testUser2.id);
    });

    it("should create a direct message room without name", async () => {
      // Act
      const isDirect = true;
      const userIds = [testUser1.id, testUser2.id];

      const result = await service.createRoom({
        name: undefined,
        isDirect,
        userIds,
        ownerId: testUser1.id,
        isPrivate: false,
      });

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.name).toBe("");
      expect(result.isDirect).toBe(true);

      // Verify room users were created
      const roomId = result.id;
      const roomUsers = await roomUserRepository.find({ room: { id: roomId } });
      expect(roomUsers.length).toBe(2);
    });
  });

  describe("getRoomById", () => {
    it("should return a room by id", async () => {
      // Act
      const room = await service.getRoomById({
        roomId: testRoom.id,
        userId: testUser1.id,
      });

      // Assert
      expect(room).toBeDefined();
      expect(room!.id).toBe(testRoom.id);
      expect(room!.name).toBe(testRoom.name);
    });

    it("should return null if room not found", async () => {
      // Act
      const room = await service.getRoomById({
        roomId: 999,
        userId: testUser1.id,
      });

      // Assert
      expect(room).toBeNull();
    });
  });

  describe("getRoomUsers", () => {
    it("should return users in a room", async () => {
      // Act
      const users = await service.getRoomUsers(testRoom.id);

      // Assert
      expect(users).toBeDefined();
      expect(Array.isArray(users)).toBe(true);
      expect(users.length).toBe(2);

      const userIds = users.map((u) => u.userId);
      expect(userIds).toContain(testUser1.id);
      expect(userIds).toContain(testUser2.id);
    });
  });

  describe("addUserToRoom", () => {
    it("should add a user to a room", async () => {
      // Arrange
      const newUser = new User();
      newUser.email = "newuser@example.com";
      newUser.nickname = "NewUser";
      newUser.passwordHash = await bcrypt.hash("password", 10);
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
        { populate: ["room", "user"] },
      );
      expect(verifyRoomUser).toBeDefined();
      expect(verifyRoomUser!.joinedAt).toBeDefined();
    });

    it("should return existing roomUser if user already in room", async () => {
      // Act
      const roomUser = await service.addUserToRoom(testRoom.id, testUser1.id);

      // Assert
      expect(roomUser).toBeDefined();
      expect(roomUser.room.id).toBe(testRoom.id);
      expect(roomUser.user.id).toBe(testUser1.id);
    });
  });

  describe("removeUserFromRoom", () => {
    it("should remove a user from a room", async () => {
      // Act
      const result = await service.removeUserFromRoom(
        testRoom.id,
        testUser1.id,
      );

      // Assert
      expect(result).toBe(true);

      // Verify user was removed from room
      const verifyRoomUser = await roomUserRepository.findOne({
        room: { id: testRoom.id },
        user: { id: testUser1.id },
      });
      expect(verifyRoomUser).toBeNull();
    });

    it("should return false if user not in room", async () => {
      // Arrange
      const newUser = new User();
      newUser.email = "notinroom@example.com";
      newUser.nickname = "NotInRoom";
      newUser.passwordHash = await bcrypt.hash("password", 10);
      await em.persistAndFlush(newUser);
      em.clear();

      // Act
      const result = await service.removeUserFromRoom(testRoom.id, newUser.id);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe("canUserJoinRoom", () => {
    it("should return true if user is already in the room", async () => {
      // Act
      const result = await service.canUserJoinRoom({
        userId: testUser1.id,
        roomId: testRoom.id,
      });

      // Assert
      expect(result).toBe(true);
    });

    it("should return false if room does not exist", async () => {
      // Act
      const result = await service.canUserJoinRoom({
        userId: testUser1.id,
        roomId: 999,
      });

      // Assert
      expect(result).toBe(false);
    });

    it("should return false if user is not in a private room", async () => {
      // Arrange
      const newUser = new User();
      newUser.email = "cantjoin@example.com";
      newUser.nickname = "CantJoin";
      newUser.passwordHash = await bcrypt.hash("password", 10);
      await em.persistAndFlush(newUser);

      const privateRoom = new Room();
      privateRoom.name = "Private Room";
      privateRoom.isDirect = false;
      privateRoom.isPrivate = true;
      privateRoom.isActive = true;
      privateRoom.ownerId = testUser1.id;
      await em.persistAndFlush(privateRoom);

      em.clear();

      // Act
      const result = await service.canUserJoinRoom({
        userId: newUser.id,
        roomId: privateRoom.id,
      });

      // Assert
      expect(result).toBe(false);
    });
  });

  describe("isUserInRoom", () => {
    it("should return true if user is in the room", async () => {
      // Act
      const result = await service.isUserInRoom({
        userId: testUser1.id,
        roomId: testRoom.id,
      });

      // Assert
      expect(result).toBe(true);
    });

    it("should return false if user is not in the room", async () => {
      // Arrange
      const newUser = new User();
      newUser.email = "notinroom@example.com";
      newUser.nickname = "NotInRoom";
      newUser.passwordHash = await bcrypt.hash("password", 10);
      await em.persistAndFlush(newUser);
      em.clear();

      // Act
      const result = await service.isUserInRoom({
        userId: newUser.id,
        roomId: testRoom.id,
      });

      // Assert
      expect(result).toBe(false);
    });
  });

  describe("updateLastSeen", () => {
    it("should update the lastSeenAt timestamp", async () => {
      // Arrange
      const originalRoomUser = await roomUserRepository.findOne({
        room: { id: testRoom.id },
        user: { id: testUser1.id },
      });
      const originalLastSeen = originalRoomUser!.lastSeenAt;

      // Wait a bit to ensure timestamp differs
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Act
      await service.updateLastSeen(testUser1.id, testRoom.id);

      // Assert
      const updatedRoomUser = await roomUserRepository.findOne({
        room: { id: testRoom.id },
        user: { id: testUser1.id },
      });
      expect(updatedRoomUser!.lastSeenAt).not.toEqual(originalLastSeen);
    });

    it("should do nothing if roomUser not found", async () => {
      // Arrange
      const newUser = new User();
      newUser.email = "notinroom2@example.com";
      newUser.nickname = "NotInRoom2";
      newUser.passwordHash = await bcrypt.hash("password", 10);
      await em.persistAndFlush(newUser);
      em.clear();

      // Act - Should not throw
      await service.updateLastSeen(newUser.id, testRoom.id);

      // Assert - Nothing to assert, just checking it doesn't throw
    });
  });

  describe("getPublicRooms", () => {
    beforeEach(async () => {
      // Create test public and private rooms
      const publicRoom1 = new Room();
      publicRoom1.name = "Public Room 1";
      publicRoom1.isDirect = false;
      publicRoom1.isPrivate = false;
      publicRoom1.isActive = true;
      publicRoom1.ownerId = testUser1.id;

      const publicRoom2 = new Room();
      publicRoom2.name = "Public Room 2";
      publicRoom2.isDirect = false;
      publicRoom2.isPrivate = false;
      publicRoom2.isActive = true;
      publicRoom2.ownerId = testUser2.id;

      const privateRoom = new Room();
      privateRoom.name = "Private Room";
      privateRoom.isDirect = false;
      privateRoom.isPrivate = true;
      privateRoom.isActive = true;
      privateRoom.ownerId = testUser1.id;

      const directRoom = new Room();
      directRoom.name = "Direct Room";
      directRoom.isDirect = true;
      directRoom.isPrivate = true;
      directRoom.isActive = true;
      directRoom.ownerId = testUser1.id;

      const inactiveRoom = new Room();
      inactiveRoom.name = "Inactive Room";
      inactiveRoom.isDirect = false;
      inactiveRoom.isPrivate = false;
      inactiveRoom.isActive = false;
      inactiveRoom.ownerId = testUser1.id;

      await em.persistAndFlush([
        publicRoom1,
        publicRoom2,
        privateRoom,
        directRoom,
        inactiveRoom,
      ]);
      em.clear();
    });

    it("should return only public, active, non-direct rooms", async () => {
      // Act
      const result = await service.getPublicRooms({ page: 1, limit: 10 });

      // Assert
      expect(result).toBeDefined();
      expect(result.items).toBeDefined();
      expect(Array.isArray(result.items)).toBe(true);

      // Should return the 2 public rooms + the test room created in beforeEach
      expect(result.totalItems).toBe(3);
      expect(result.items.length).toBe(3);

      // Check that all returned rooms are public and non-direct
      for (const room of result.items) {
        expect(room.isPrivate).toBe(false);
        expect(room.isDirect).toBe(false);
        expect(room.isActive).toBe(true);
      }

      // Check that the rooms have the expected names
      const roomNames = result.items.map((room) => room.name);
      expect(roomNames).toContain("Test Room");
      expect(roomNames).toContain("Public Room 1");
      expect(roomNames).toContain("Public Room 2");
    });

    it("should filter rooms by search term", async () => {
      // Act
      const result = await service.getPublicRooms({
        search: "Public Room 1",
        page: 1,
        limit: 10,
      });

      // Assert
      expect(result).toBeDefined();
      expect(result.items).toBeDefined();
      expect(result.items.length).toBe(1);
      expect(result.items[0].name).toBe("Public Room 1");
    });

    it("should paginate results", async () => {
      // Act
      const result = await service.getPublicRooms({ page: 1, limit: 2 });

      // Assert
      expect(result).toBeDefined();
      expect(result.items).toBeDefined();
      expect(result.items.length).toBe(2);
      expect(result.totalItems).toBe(3);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(2);
    });

    it("should include unread counts when userId is provided", async () => {
      // Act
      const result = await service.getPublicRooms(
        { page: 1, limit: 10 },
        testUser1.id,
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.items).toBeDefined();

      // Each room should have an unreadCount property
      for (const room of result.items) {
        expect(room).toHaveProperty("unreadCount");
        expect(typeof room.unreadCount).toBe("number");
      }
    });
  });
});
