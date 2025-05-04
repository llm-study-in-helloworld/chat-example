import { RoomRole, RoomType } from '@chat-example/types';
import { EntityManager, QueryOrder } from '@mikro-orm/core';
import { EntityRepository } from '@mikro-orm/mysql';
import { InjectRepository } from '@mikro-orm/nestjs';
import { Injectable, NotFoundException, UseInterceptors } from '@nestjs/common';
import { RoomResponseDto, RoomUserResponseDto } from '../dto';
import { Room, RoomUser, User } from '../entities';
import { LoggerService, LogInterceptor } from '../logger';
import { RoomQueryDto, UpdateRoomRequestDto } from './dto';
/**
 * 채팅방 관련 비즈니스 로직을 처리하는 서비스
 */
@UseInterceptors(LogInterceptor)
@Injectable()
export class RoomsService {
  constructor(
    @InjectRepository(Room)
    private readonly roomRepository: EntityRepository<Room>,
    @InjectRepository(RoomUser)
    private readonly roomUserRepository: EntityRepository<RoomUser>,
    @InjectRepository(User)
    private readonly userRepository: EntityRepository<User>,
    private readonly em: EntityManager,
    private readonly logger: LoggerService
  ) {}

  async isOwner({roomId, userId}: {roomId: number, userId: number}): Promise<boolean> {
      this.logger.debug(`Checking if user ${userId} is owner of room ${roomId}`, 'RoomsService');
      
      const roomUser = await this.roomUserRepository.findOne({
        room: { id: roomId },
        user: { id: userId },
        role: RoomRole.OWNER
      }, { fields: ['id'] });

      const isOwner = roomUser !== null;
      this.logger.debug(`User ${userId} is ${isOwner ? '' : 'not '}owner of room ${roomId}`, 'RoomsService');
      
      return isOwner;
  }

  /**
   * 특정 사용자가 참여 중인 모든 채팅방 목록 조회
   */
  async getUserRooms(userId: number): Promise<RoomResponseDto[]> {
      this.logger.debug(`Fetching rooms for user ${userId}`, 'RoomsService');
      
      const roomUsers = await this.roomUserRepository.find(
        { user: { id: userId } }, 
        {orderBy: { room: { updatedAt: QueryOrder.DESC } }, fields: ['room'], populate: ['room'] }
      );
      
      this.logger.debug(`Found ${roomUsers.length} rooms for user ${userId}`, 'RoomsService');
      
      const rooms = await this.formatRoomResponse(roomUsers.map(ru => ru.room), userId);
      return rooms;
  }
  
  /**
   * 새로운 채팅방 생성
   */
  async createRoom({name, isDirect, userIds, ownerId, isPrivate}: {
    name: string | undefined,
    isDirect: boolean,
    userIds: number[],
    ownerId: number,
    isPrivate: boolean
  }): Promise<RoomResponseDto> {
      // 트랜잭션 시작
      const userIdsSet = new Set([...userIds, ownerId]);
      
      this.logger.debug(`Creating ${isDirect ? 'direct' : 'group'} room with ${userIdsSet.size} users`, 'RoomsService');
      
      if (isDirect) {
        this.logger.debug(`Checking for existing direct room with users: ${Array.from(userIdsSet).join(', ')}`, 'RoomsService');
      }

      const result = await this.em.transactional(async (em) => {
        if(isDirect) {
          const existingRoom = await this.roomRepository.createQueryBuilder('r')
            .select('r.*')
            .leftJoin('r.roomUsers', 'ru')
            .leftJoin('ru.user', 'u')
            .where({
              isDirect: true,
              isActive: true,
              roomUsers: { user: { id: { $in: Array.from(userIdsSet) } } }
            })
            .groupBy('r.id')
            .having('COUNT(distinct ru.user_id) = ?', [userIdsSet.size])
            .getResult();
            
          if(existingRoom.length > 0) {
            this.logger.debug(`Found existing direct room with ID ${existingRoom[0].id}`, 'RoomsService');
            return existingRoom[0];
          }
        }

        this.logger.debug(`Creating new room "${name || ''}"`, 'RoomsService');
        this.logger.logDatabase('transaction', 'Room', { operation: 'create' }, 'RoomsService');
        
        const room = new Room();
        room.name = name || '';
        room.isDirect = isDirect;
        room.isPrivate = isPrivate;
        room.isActive = true;
        room.ownerId = ownerId;
        
        await em.persistAndFlush(room);
        this.logger.logDatabase('persist', 'Room', { id: room.id }, 'RoomsService');
        
        // Create room users in bulk
        const roomUsers = [];
        const users = await this.userRepository.find({ id: { $in: Array.from(userIdsSet) } });

        for (const user of users) {
          const roomUser = new RoomUser();
          roomUser.room = room;
          roomUser.user = user;
          roomUser.joinedAt = new Date();
          roomUser.lastSeenAt = new Date();
          roomUser.role = user.id === ownerId ? RoomRole.OWNER : RoomRole.MEMBER;
          
          roomUsers.push(roomUser);
        }
        
        // Persist all roomUsers at once
        await em.persistAndFlush(roomUsers);
        this.logger.logDatabase('persist', 'RoomUser', { count: roomUsers.length }, 'RoomsService');
        
        return room;
      });

      const formattedRoom = (await this.formatRoomResponse([result], result.ownerId))[0];
      this.logger.log(`Room created: ID ${result.id}, name: "${result.name}", owner: ${result.ownerId}`, 'RoomsService');
      
      return formattedRoom;
  }

  /**
   * 채팅방 정보 조회
   */
  async getRoomById({roomId, userId}: {roomId: number, userId: number}): Promise<RoomResponseDto | null> {
      this.logger.debug(`Fetching room ${roomId} for user ${userId}`, 'RoomsService');
      
      // Use a direct SQL query to efficiently load room with its users in a single operation
      const room = await this.roomRepository.findOne(
        { id: roomId, isActive: true }
      );

      if (!room) {
        this.logger.debug(`Room ${roomId} not found or not active`, 'RoomsService');
        return null;
      }
      
      // Use the roomId to get all roomUsers in one query to avoid N+1 issue
      await this.em.populate(room, ['roomUsers.user'] as any);

      const roomDtos = await this.formatRoomResponse([room], userId);
      return roomDtos[0];
  }
  /**
   * 채팅방의 참여자 목록 조회
   */
  async getRoomUsers(roomId: number): Promise<RoomUserResponseDto[]> {
      this.logger.debug(`Fetching users for room ${roomId}`, 'RoomsService');
      
      const roomUsers = await this.roomUserRepository.find(
        { room: { id: roomId } }, 
        { populate: ['user'] }
      );
      
      this.logger.debug(`Found ${roomUsers.length} users in room ${roomId}`, 'RoomsService');
      
      return roomUsers.map((roomUser: RoomUser) => RoomUserResponseDto.fromEntity(roomUser));
  }

  /**
   * 사용자를 채팅방에 추가
   */
  async addUserToRoom(roomId: number, userId: number): Promise<RoomUser> {
      this.logger.debug(`Adding user ${userId} to room ${roomId}`, 'RoomsService');
      
      // Find both the room and user in parallel to avoid sequential queries
      const [room, user, existingRoomUser] = await Promise.all([
        this.roomRepository.findOneOrFail({ id: roomId }),
        this.userRepository.findOneOrFail({ id: userId }),
        this.roomUserRepository.findOne({
          room: { id: roomId },
          user: { id: userId }
        })
      ]);
      
      // If user is already in the room, return the existing roomUser
      if (existingRoomUser) {
        this.logger.debug(`User ${userId} is already in room ${roomId}`, 'RoomsService');
        return existingRoomUser;
      }
      
      // Create new RoomUser entity
      this.logger.debug(`Creating new room user for user ${userId} in room ${roomId}`, 'RoomsService');
      
      const roomUser = new RoomUser();
      roomUser.room = room;
      roomUser.user = user;
      roomUser.joinedAt = new Date();
      roomUser.lastSeenAt = new Date();
      roomUser.role = RoomRole.MEMBER;
      
      await this.em.persistAndFlush(roomUser);
      this.logger.logDatabase('persist', 'RoomUser', { roomId, userId }, 'RoomsService');
      
      this.logger.log(`User ${userId} added to room ${roomId}`, 'RoomsService');
      return roomUser;
  }

  /**
   * 사용자를 채팅방에서 제거
   */
  async removeUserFromRoom(roomId: number, userId: number): Promise<boolean> {
      this.logger.debug(`Removing user ${userId} from room ${roomId}`, 'RoomsService');
      
      const result = await this.roomUserRepository.nativeDelete({ room: { id: roomId }, user: { id: userId }});
      this.logger.logDatabase('delete', 'RoomUser', { roomId, userId }, 'RoomsService');
      
      await this.em.flush();
      
      const success = result > 0;
      if (success) {
        this.logger.log(`User ${userId} removed from room ${roomId}`, 'RoomsService');
      } else {
        this.logger.debug(`User ${userId} was not in room ${roomId}`, 'RoomsService');
      }
      
      return success;
  }

  /**
   * 사용자가 채팅방에 접근할 권한이 있는지 확인
   */
  async canUserJoinRoom({userId, roomId}: {userId: number, roomId: number}): Promise<boolean> {
    this.logger.debug(`Checking if user ${userId} can join room ${roomId}`, 'RoomsService');
    
      const room = await this.roomRepository.findOne({ id: roomId }, { fields: ['ownerId', 'isPrivate', 'isDirect', 'isActive'] });
      if (!room) {
        this.logger.debug(`Room ${roomId} not found`, 'RoomsService');
        return false;
      }

      // Check if user is already in the room
      const isUserInRoom = await this.isUserInRoom({userId, roomId});
      
      // If user is not in the room, they can only join public, non-direct rooms
      if (!isUserInRoom) {
        const canJoin = !room.isPrivate && !room.isDirect && room.isActive;
        this.logger.debug(`User ${userId} is not in room ${roomId}. Can join: ${canJoin}`, 'RoomsService');
        return canJoin;
      }

      this.logger.debug(`User ${userId} is already in room ${roomId}`, 'RoomsService');
      return true;
  }


  async isUserInRoom({userId, roomId}: {userId: number, roomId: number}): Promise<boolean> {
    this.logger.debug(`Checking if user ${userId} is in room ${roomId}`, 'RoomsService');
      
      // Use a direct SQL query to check for existence
      const result = await this.roomUserRepository.findOne({
        room: { id: roomId },
        user: { id: userId }
      }, { fields: ['id'] });

      const isInRoom = result !== null;
      this.logger.debug(`User ${userId} is ${isInRoom ? '' : 'not '}in room ${roomId}`, 'RoomsService');
      
      return isInRoom;
  }

  /**
   * 채팅방 마지막 읽은 시간 업데이트
   */
  async updateLastSeen(userId: number, roomId: number): Promise<void> {
    this.logger.debug(`Updating last seen time for user ${userId} in room ${roomId}`, 'RoomsService');
      
      const roomUser = await this.roomUserRepository.findOne({
        room: { id: roomId },
        user: { id: userId }
      });
      
      if (roomUser) {
        roomUser.lastSeenAt = new Date();
        await this.em.flush();
        this.logger.logDatabase('update', 'RoomUser', { roomId, userId, lastSeenAt: roomUser.lastSeenAt }, 'RoomsService');
        this.logger.debug(`Updated last seen time for user ${userId} in room ${roomId}`, 'RoomsService');
      } else {
        this.logger.debug(`User ${userId} not found in room ${roomId}, cannot update last seen time`, 'RoomsService');
      }
  }


  /**
   * 채팅방 목록을 DTO로 변환
   * @private
   */
  private async formatRoomResponse(rooms: Room[], userId: number): Promise<RoomResponseDto[]> {
    this.logger.debug(`Formatting response for ${rooms.length} rooms`, 'RoomsService');
    
    if (rooms.length === 0) {
      return [];
    }

      this.logger.debug(`Formatting response for ${rooms.length} rooms`, 'RoomsService');
      
      // Get all room IDs 
      const roomIds = rooms.map(room => room.id);
      
      // Get unread counts for all rooms
      const counts = await this.calculateUnreadCounts(roomIds, userId);
      
      // For direct messages, get all other users' information in one query
      const otherUsersByRoomId: Record<number, any> = await this.getDirectMessageUser(rooms, userId);
      
      // Process rooms one at a time to avoid circular references
      const roomDtos: RoomResponseDto[] = [];
      
      for (const room of rooms) {
        // Create a DTO using the fromEntity method
        const dto = RoomResponseDto.fromEntity(room);
        
        // Add unread count
        dto.unreadCount = counts[room.id] || 0;
        
        dto.otherUser = otherUsersByRoomId[room.id];
        
        roomDtos.push(dto);
      }
      
    return roomDtos;
  }

  
  private async getDirectMessageUser(rooms: Room[], userId: number) {
    this.logger.debug(`Getting other users for ${rooms.length} direct messages`, 'RoomsService');
    
      const directRooms = rooms.filter(room => room.isDirect);
      const directRoomIds = directRooms.map(room => room.id);
      
      this.logger.debug(`Getting other users for ${directRoomIds.length} direct messages`, 'RoomsService');

      // Create a map to store otherUsers by roomId
      const otherUsersByRoomId: Record<number, any> = {};

      if (directRoomIds.length > 0) {
        // Get all room users for direct rooms in a single query
        const otherUsersQuery = await this.em.getConnection().execute(`
          SELECT ru.room_id, u.id, u.nickname, u.image_url 
          FROM room_user ru
          JOIN \`user\` u ON ru.user_id = u.id
          WHERE ru.room_id IN (${directRoomIds.join(',')})
          AND ru.user_id != ${userId}
        `);
        
        this.logger.logDatabase('query', 'RoomUser', { operation: 'getDirectMessageUsers', directRoomIds }, 'RoomsService');

        // Organize results by room ID
        for (const result of otherUsersQuery) {
          otherUsersByRoomId[result.room_id] = {
            id: result.id,
            nickname: result.nickname,
            imageUrl: result.image_url
          };
        }
      }
      
      return otherUsersByRoomId;
  }

  /**
   * 사용자의 각 채팅방 별 읽지 않은 메시지 수 계산
   * @private
   */
  private async calculateUnreadCounts(roomIds: number[], userId: number): Promise<Record<number, number>> {
    this.logger.debug(`Calculating unread counts for user ${userId} in ${roomIds.length} rooms`, 'RoomsService');
    
      if (roomIds.length === 0) {
        return {};
      }
      
      this.logger.debug(`Calculating unread counts for user ${userId} in ${roomIds.length} rooms`, 'RoomsService');
      
      // Execute SQL to get unread counts - more efficient than multiple queries
      const results = await this.em.getConnection().execute(`
        SELECT m.room_id as room_id, COUNT(m.id) as count
        FROM message m
        LEFT JOIN room_user ru ON m.room_id = ru.room_id AND ru.user_id = ${userId}
        WHERE m.room_id IN (${roomIds.join(',')})
          AND m.created_at > COALESCE(ru.last_seen_at, '1970-01-01')
          AND m.sender_id != ${userId}
          AND m.deleted_at IS NULL
        GROUP BY m.room_id
      `);
      
      this.logger.logDatabase('query', 'Message', { operation: 'countUnread', roomIds }, 'RoomsService');
      
      // Convert results to a record with roomId as key
      const counts: Record<number, number> = {};
      for (const result of results) {
        counts[result.room_id] = parseInt(result.count);
      }
      
      // Set default counts for rooms without results
      for (const id of roomIds) {
        if (counts[id] === undefined) {
          counts[id] = 0;
        }
      }
      
      return counts;
  }

  /**
   * 채팅방 정보 업데이트
   */
  async updateRoom(roomId: number, updateRoomDto: UpdateRoomRequestDto): Promise<RoomResponseDto | null> {
      this.logger.debug(`Updating room ${roomId}`, 'RoomsService');
      
      const room = await this.roomRepository.findOne({ id: roomId });
      
      if (!room) {
        this.logger.warn(`Room with ID ${roomId} not found during update attempt`, 'RoomsService');
        throw new NotFoundException(`Room with ID ${roomId} not found`);
      }
      
      // Apply updates using the DTO's applyTo method
      updateRoomDto.applyTo(room);
      
      await this.em.flush();
      this.logger.logDatabase('update', 'Room', { id: roomId }, 'RoomsService');
      
      const roomDtos = await this.formatRoomResponse([room], room.ownerId);
      this.logger.log(`Room ${roomId} updated successfully`, 'RoomsService');
      
      return roomDtos[0];
  }

  /**
   * 채팅방 삭제
   */
  async deleteRoom(roomId: number): Promise<boolean> {
    this.logger.debug(`Deleting room ${roomId}`, 'RoomsService');
      
      const room = await this.roomRepository.findOne({ id: roomId });
      
      if (!room) {
        this.logger.warn(`Room with ID ${roomId} not found during delete attempt`, 'RoomsService');
        throw new NotFoundException(`Room with ID ${roomId} not found`);
      }
      
      // Soft delete - mark as inactive
      room.isActive = false;
      await this.em.flush();
      this.logger.logDatabase('softDelete', 'Room', { id: roomId }, 'RoomsService');
      
      this.logger.log(`Room ${roomId} soft-deleted successfully`, 'RoomsService');
      return true;
  }

  /**
   * 사용자의 채팅방 역할 업데이트
   */
  async updateUserRole(roomId: number, userId: number, role: RoomRole): Promise<RoomUserResponseDto> {
    this.logger.debug(`Updating role for user ${userId} in room ${roomId} to ${role}`, 'RoomsService');
      
      
      const roomUser = await this.roomUserRepository.findOne({
        room: { id: roomId },
        user: { id: userId }
      }, { populate: ['user'] });
      
      if (!roomUser) {
        this.logger.warn(`User with ID ${userId} not found in room with ID ${roomId} during role update`, 'RoomsService');
        throw new NotFoundException(`User with ID ${userId} not found in room with ID ${roomId}`);
      }
      
      roomUser.role = role;
      await this.em.flush();
      this.logger.logDatabase('update', 'RoomUser', { roomId, userId, role }, 'RoomsService');
      
      this.logger.log(`Updated role for user ${userId} in room ${roomId} to ${role}`, 'RoomsService');
      return RoomUserResponseDto.fromEntity(roomUser);
  }

  /**
   * 조건 및 페이지네이션에 따른 사용자의 채팅방 목록 조회
   */
  async getUserRoomsWithFilters(
    userId: number, 
    query: RoomQueryDto
  ): Promise<{ items: RoomResponseDto[], totalItems: number, page: number, limit: number }> {
      const { type, search, page = 1, limit = 10 } = query;
      
      this.logger.debug(`Fetching rooms for user ${userId} with filters: ${JSON.stringify({ type, search, page, limit })}`, 'RoomsService');
      
      // Get all rooms for the user
      const allRooms = await this.getUserRooms(userId);
      
      // Apply filters
      let filteredRooms = allRooms;
      
      // Filter by type
      if (type === RoomType.DIRECT) {
        this.logger.debug(`Filtering for direct messages only`, 'RoomsService');
        filteredRooms = filteredRooms.filter(room => room.isDirect);
      } else if (type === RoomType.GROUP) {
        this.logger.debug(`Filtering for group chats only`, 'RoomsService');
        filteredRooms = filteredRooms.filter(room => !room.isDirect);
      }
      
      // Filter by search term
      if (search) {
        this.logger.debug(`Filtering by search term: "${search}"`, 'RoomsService');
        const searchLower = search.toLowerCase();
        filteredRooms = filteredRooms.filter(room => 
          room.name.toLowerCase().includes(searchLower)
        );
      }
      
      // Get total count before pagination
      const totalItems = filteredRooms.length;
      
      // Apply pagination
      const startIndex = (page - 1) * limit;
      const endIndex = Math.min(startIndex + limit, filteredRooms.length);
      const paginatedRooms = filteredRooms.slice(startIndex, endIndex);
      
      this.logger.debug(`Found ${totalItems} rooms total, returning ${paginatedRooms.length} for page ${page}`, 'RoomsService');
      
      return {
        items: paginatedRooms,
        totalItems,
        page,
        limit
      };
  }

  /**
   * 모든 공개 채팅방 검색
   */
  async getPublicRooms(
    query: RoomQueryDto,
    userId?: number
  ): Promise<{ items: RoomResponseDto[], totalItems: number, page: number, limit: number }> {
    
      const { search, page = 1, limit = 10 } = query;
      
      this.logger.debug(`Fetching public rooms with search: "${search || ''}", page: ${page}, limit: ${limit}`, 'RoomsService');
      
      // Base conditions for public rooms
      const baseConditions = { 
        isPrivate: false, 
        isDirect: false,
        isActive: true
      };
      
      // Apply search filter if provided (in a database-agnostic way)
      if (search) {
        this.logger.debug(`Applying search filter: "${search}"`, 'RoomsService');
        
        // Use find instead of QueryBuilder to avoid SQLite ilike issues
        const publicRooms = await this.roomRepository.find({
          ...baseConditions,
          name: { $like: `%${search}%` }  // Use $like instead of $ilike for SQLite compatibility
        }, {
          orderBy: { createdAt: QueryOrder.DESC },
          limit,
          offset: (page - 1) * limit
        });
        
        // Get total count with the same filters
        const totalItems = await this.roomRepository.count({
          ...baseConditions,
          name: { $like: `%${search}%` }
        });
        
        this.logger.debug(`Found ${totalItems} public rooms matching search, returning ${publicRooms.length} for page ${page}`, 'RoomsService');
        
        // Format rooms to DTOs
        const roomDtos = userId 
          ? await this.formatRoomResponse(publicRooms, userId)
          : publicRooms.map((room: Room) => RoomResponseDto.fromEntity(room));
        
        return {
          items: roomDtos,
          totalItems,
          page,
          limit
        };
      }
      
      // If no search filter, get all public rooms with pagination
      this.logger.debug(`Fetching all public rooms with pagination`, 'RoomsService');
      
      const publicRooms = await this.roomRepository.find(
        baseConditions,
        {
          orderBy: { createdAt: QueryOrder.DESC },
          limit,
          offset: (page - 1) * limit
        }
      );
      
      // Get total count of public rooms
      const totalItems = await this.roomRepository.count(baseConditions);
      
      this.logger.debug(`Found ${totalItems} public rooms total, returning ${publicRooms.length} for page ${page}`, 'RoomsService');
      
      // Format rooms to DTOs
      const roomDtos = userId 
        ? await this.formatRoomResponse(publicRooms, userId)
        : publicRooms.map((room: Room) => RoomResponseDto.fromEntity(room));
      
      return {
        items: roomDtos,
        totalItems,
        page,
        limit
      };
    }
} 