import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { UsersService } from '../../src/users/users.service';
import { User } from '../../src/entities';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from '../../src/users/dto/create-user.dto';
import { UpdateUserDto } from '../../src/users/dto/update-user.dto';

// Mock bcrypt
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashedPassword'),
  compare: jest.fn(),
}));

describe('UsersService', () => {
  let service: UsersService;
  let mockEntityManager: EntityManager;
  let mockUserRepository: jest.Mocked<EntityRepository<User>>;

  beforeEach(async () => {
    // Create mock implementations
    mockUserRepository = {
      findOne: jest.fn(),
      persist: jest.fn(),
      flush: jest.fn(),
    } as any;

    mockEntityManager = {
      findOne: jest.fn(),
      persistAndFlush: jest.fn(),
      flush: jest.fn(),
      removeAndFlush: jest.fn(),
      clear: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: EntityManager,
          useValue: mockEntityManager,
        },
        {
          provide: 'UserRepository',
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    // Manually inject repository
    (service as any).userRepository = mockUserRepository;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createUser', () => {
    const createUserDto: CreateUserDto = {
      email: 'test@example.com',
      password: 'password123',
      nickname: 'TestUser',
    };

    it('should create a new user successfully', async () => {
      // Mock user repository to return no existing user
      mockUserRepository.findOne.mockResolvedValue(null);

      // Mock entity manager
      const createdUser = new User();
      createdUser.id = 1;
      createdUser.email = createUserDto.email;
      createdUser.nickname = createUserDto.nickname;
      createdUser.passwordHash = 'hashedPassword';
      createdUser.createdAt = new Date();
      createdUser.updatedAt = new Date();

      mockEntityManager.persistAndFlush.mockImplementation(async (user) => {
        (user as User).id = 1;
        (user as User).createdAt = new Date();
        (user as User).updatedAt = new Date();
      });

      // Call the service method
      const result = await service.createUser(createUserDto);

      // Check if repository methods were called
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ email: createUserDto.email });
      expect(bcrypt.hash).toHaveBeenCalledWith(createUserDto.password, 10);
      expect(mockEntityManager.persistAndFlush).toHaveBeenCalled();

      // Check the result
      expect(result).toBeDefined();
      expect(result.email).toBe(createUserDto.email);
      expect(result.nickname).toBe(createUserDto.nickname);
    });

    it('should throw ConflictException if user already exists', async () => {
      // Mock user repository to return an existing user
      const existingUser = new User();
      existingUser.email = createUserDto.email;
      mockUserRepository.findOne.mockResolvedValue(existingUser);

      // Check if the service throws an exception
      await expect(service.createUser(createUserDto)).rejects.toThrow(ConflictException);
      expect(mockEntityManager.persistAndFlush).not.toHaveBeenCalled();
    });
  });

  describe('findByEmail', () => {
    it('should return a user if found', async () => {
      const mockUser = new User();
      mockUser.email = 'test@example.com';
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findByEmail('test@example.com');
      expect(result).toBe(mockUser);
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
    });

    it('should return null if user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      const result = await service.findByEmail('nonexistent@example.com');
      expect(result).toBeNull();
    });
  });

  describe('updateUserProfile', () => {
    const userId = 1;
    const updateUserDto: UpdateUserDto = {
      nickname: 'UpdatedUser',
      imageUrl: 'https://example.com/image.jpg',
    };

    it('should update user profile successfully', async () => {
      // Mock user
      const mockUser = new User();
      mockUser.id = userId;
      mockUser.nickname = 'OldName';
      mockUser.imageUrl = 'old-image.jpg';
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      // Call service method
      await service.updateUserProfile(userId, updateUserDto);

      // Check if user was updated correctly
      expect(mockUser.nickname).toBe(updateUserDto.nickname);
      expect(mockUser.imageUrl).toBe(updateUserDto.imageUrl);
      expect(mockEntityManager.flush).toHaveBeenCalled();
    });

    it('should throw NotFoundException if user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.updateUserProfile(userId, updateUserDto)).rejects.toThrow(NotFoundException);
    });

    it('should change password if current and new passwords are provided', async () => {
      // Mock user
      const mockUser = new User();
      mockUser.id = userId;
      mockUser.passwordHash = 'oldHash';
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      // Setup bcrypt mock
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      // Password change request
      const passwordUpdateDto: UpdateUserDto = {
        nickname: 'UpdatedUser',
        currentPassword: 'oldPassword',
        newPassword: 'newPassword123',
      };

      // Call service method
      await service.updateUserProfile(userId, passwordUpdateDto);

      // Check if password was updated
      expect(bcrypt.compare).toHaveBeenCalledWith(passwordUpdateDto.currentPassword, mockUser.passwordHash);
      expect(bcrypt.hash).toHaveBeenCalledWith(passwordUpdateDto.newPassword, 10);
      expect(mockUser.passwordHash).toBe('hashedPassword');
      expect(mockEntityManager.flush).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if current password is incorrect', async () => {
      // Mock user
      const mockUser = new User();
      mockUser.id = userId;
      mockUser.passwordHash = 'oldHash';
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      // Setup bcrypt mock to return false (incorrect password)
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      // Password change request
      const passwordUpdateDto: UpdateUserDto = {
        nickname: 'UpdatedUser',
        currentPassword: 'wrongPassword',
        newPassword: 'newPassword123',
      };

      // Check if service throws exception
      await expect(service.updateUserProfile(userId, passwordUpdateDto)).rejects.toThrow(UnauthorizedException);
      expect(mockEntityManager.flush).not.toHaveBeenCalled();
    });
  });

  describe('deleteUser', () => {
    it('should delete a user if password is correct', async () => {
      // Mock user
      const mockUser = new User();
      mockUser.id = 1;
      mockUser.passwordHash = 'hashedPassword';
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      // Setup bcrypt mock
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      // Call service method
      const result = await service.deleteUser(1, 'correctPassword');

      // Check if user was deleted
      expect(mockEntityManager.removeAndFlush).toHaveBeenCalledWith(mockUser);
      expect(result).toBe(true);
    });

    it('should throw UnauthorizedException if password is incorrect', async () => {
      // Mock user
      const mockUser = new User();
      mockUser.id = 1;
      mockUser.passwordHash = 'hashedPassword';
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      // Setup bcrypt mock to return false (incorrect password)
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      // Check if service throws exception
      await expect(service.deleteUser(1, 'wrongPassword')).rejects.toThrow(UnauthorizedException);
      expect(mockEntityManager.removeAndFlush).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.deleteUser(999, 'anyPassword')).rejects.toThrow(NotFoundException);
    });
  });
}); 