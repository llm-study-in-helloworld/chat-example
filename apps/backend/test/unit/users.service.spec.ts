import { EntityManager, MikroORM } from "@mikro-orm/core";
import { EntityRepository } from "@mikro-orm/mysql";
import { MikroOrmModule } from "@mikro-orm/nestjs";
import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { UserResponseDto } from "../../src/dto";
import { User } from "../../src/entities";
import { LoggerService } from "../../src/logger/logger.service";
import { ChangePasswordDto } from "../../src/users/dto/change-password.dto";
import { CreateUserDto } from "../../src/users/dto/create-user.dto";
import { UpdateUserDto } from "../../src/users/dto/update-user.dto";
import { UsersService } from "../../src/users/users.service";
import testConfig from "../mikro-orm.config.test";
import { createMockLoggerService } from "./fixtures/logger.fixtures";
import { createUserFixture, TestUserData } from "./fixtures/user.fixtures";

describe("UsersService", () => {
  let service: UsersService;
  let orm: MikroORM;
  let em: EntityManager;
  let userRepository: EntityRepository<User>;
  let loggerService: LoggerService;

  // Test data
  const testPassword = "TestPassword123";

  // User instances for testing
  let testUser: User;
  let testUserData: TestUserData;
  let createdUser: User;

  beforeAll(async () => {
    // Create mock logger service
    const mockLoggerService = createMockLoggerService();

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        MikroOrmModule.forRoot(testConfig),
        MikroOrmModule.forFeature({
          entities: [User],
        }),
      ],
      providers: [
        UsersService,
        {
          provide: LoggerService,
          useValue: mockLoggerService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    orm = module.get<MikroORM>(MikroORM);
    em = module.get<EntityManager>(EntityManager);
    userRepository = em.getRepository(User);
    loggerService = module.get<LoggerService>(LoggerService);

    // Create schema
    await orm.getSchemaGenerator().createSchema();
  });

  beforeEach(async () => {
    // Clear database before each test
    await orm.getSchemaGenerator().refreshDatabase();

    // Create a test user using fixture
    testUserData = await createUserFixture(em, {
      email: "test@example.com",
      nickname: "TestUser",
      password: testPassword,
      imageUrl: "http://example.com/avatar.jpg",
    });

    // Get the actual user entity for tests that need it
    testUser = await userRepository.findOneOrFail({ id: testUserData.id });

    // Reset mocks
    jest.clearAllMocks();

    // Clear EntityManager to ensure fresh state for each test
    em.clear();
  });

  afterAll(async () => {
    await orm.close();
  });

  describe("createUser", () => {
    it("should create a new user with valid data", async () => {
      // Arrange
      const createUserDto = new CreateUserDto();
      createUserDto.email = "new@example.com";
      createUserDto.nickname = "NewUser";
      createUserDto.password = "NewPassword123";
      createUserDto.imageUrl = "http://example.com/new-avatar.jpg";

      // Act
      const result = await service.createUser(createUserDto);

      // Assert
      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(UserResponseDto);
      expect(result.email).toBe(createUserDto.email);
      expect(result.nickname).toBe(createUserDto.nickname);
      expect(result.imageUrl).toBe(createUserDto.imageUrl);

      // Verify user was saved to database
      const savedUser = await userRepository.findOne({
        email: createUserDto.email,
      });
      expect(savedUser).toBeDefined();
      expect(savedUser!.email).toBe(createUserDto.email);

      // Verify logger was called
      expect(loggerService.logMethodEntry).toHaveBeenCalled();
      expect(loggerService.logMethodExit).toHaveBeenCalled();
      expect(loggerService.log).toHaveBeenCalled();

      // Store for later tests
      createdUser = savedUser!;
    });

    it("should throw ConflictException when email already exists", async () => {
      // Arrange
      const createUserDto = new CreateUserDto();
      createUserDto.email = "test@example.com"; // Same as existing user
      createUserDto.nickname = "AnotherUser";
      createUserDto.password = "Password123";

      // Act & Assert
      await expect(service.createUser(createUserDto)).rejects.toThrow(
        ConflictException,
      );

      // Verify logger was called
      expect(loggerService.logMethodEntry).toHaveBeenCalled();
      expect(loggerService.error).toHaveBeenCalled();
    });
  });

  describe("findByEmail", () => {
    it("should find a user by email", async () => {
      // Act
      const result = await service.findByEmail("test@example.com");

      // Assert
      expect(result).toBeDefined();
      expect(result!.email).toBe("test@example.com");
      expect(result!.nickname).toBe("TestUser");
    });

    it("should return null for non-existent email", async () => {
      // Act
      const result = await service.findByEmail("nonexistent@example.com");

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("findById", () => {
    it("should find a user by id", async () => {
      // Arrange - Get the id first
      const user = await userRepository.findOneOrFail({
        email: "test@example.com",
      });

      // Act
      const result = await service.findById(user.id);

      // Assert
      expect(result).toBeDefined();
      expect(result!.id).toBe(user.id);
      expect(result!.email).toBe("test@example.com");
    });

    it("should return null for non-existent id", async () => {
      // Act
      const result = await service.findById(999999);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("updateUser", () => {
    it("should update user profile", async () => {
      // Arrange
      const user = await userRepository.findOneOrFail({
        email: "test@example.com",
      });
      const updateUserDto = new UpdateUserDto();
      updateUserDto.nickname = "UpdatedNickname";
      updateUserDto.imageUrl = "http://example.com/updated-avatar.jpg";
      updateUserDto.currentPassword = testPassword;

      // Act
      const result = await service.updateUser(user, updateUserDto);

      // Assert
      expect(result).toBeDefined();
      expect(result.nickname).toBe("UpdatedNickname");
      expect(result.imageUrl).toBe("http://example.com/updated-avatar.jpg");

      // Verify changes were saved to database
      const updatedUser = await userRepository.findOneOrFail({ id: user.id });
      expect(updatedUser.nickname).toBe("UpdatedNickname");
      expect(updatedUser.imageUrl).toBe(
        "http://example.com/updated-avatar.jpg",
      );
    });
  });

  describe("changePassword", () => {
    it("should change password when current password is correct", async () => {
      // Arrange
      const user = await userRepository.findOneOrFail({
        email: "test@example.com",
      });
      const passwordChangeDto = new ChangePasswordDto();
      passwordChangeDto.currentPassword = testPassword;
      passwordChangeDto.newPassword = "NewPassword456";

      // Act
      const result = await service.changePassword(user, passwordChangeDto);

      // Assert
      expect(result).toBe(true);

      // Verify password was changed - should be able to verify with new password
      em.clear(); // Clear identity map to ensure we get a fresh entity
      const updatedUser = await userRepository.findOneOrFail({ id: user.id });
      console.log(
        "updatedUser",
        await updatedUser.verifyPassword(testPassword),
      );
      const verifyResult = await updatedUser.verifyPassword("NewPassword456");
      expect(verifyResult).toBe(true);
    });

    it("should throw UnauthorizedException when current password is incorrect", async () => {
      // Arrange
      const user = await userRepository.findOneOrFail({
        email: "test@example.com",
      });
      const passwordChangeDto = new ChangePasswordDto();
      passwordChangeDto.currentPassword = "WrongPassword";
      passwordChangeDto.newPassword = "NewPassword789";

      // Act & Assert
      const result = await service.changePassword(user, passwordChangeDto);
      expect(result).toBeFalsy();
    });
  });

  describe("deleteUser", () => {
    it("should delete user when password is correct", async () => {
      // Arrange
      const user = await userRepository.findOneOrFail({
        email: "test@example.com",
      });

      // Act
      const result = await service.deleteUser(user, testPassword);

      // Assert
      expect(result).toBe(true);

      // Verify user was deleted
      const deletedUser = await userRepository.findOne({ id: user.id });
      expect(deletedUser).toBeNull();
    });

    it("should throw UnauthorizedException when password is incorrect", async () => {
      // Arrange
      const user = await userRepository.findOneOrFail({
        email: "test@example.com",
      });

      // Act & Assert
      await expect(service.deleteUser(user, "WrongPassword")).rejects.toThrow(
        UnauthorizedException,
      );

      // Verify user was not deleted
      const stillExistingUser = await userRepository.findOneOrFail({
        id: user.id,
      });
      expect(stillExistingUser).toBeDefined();
    });
  });
});
