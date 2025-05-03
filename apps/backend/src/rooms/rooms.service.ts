import { RoomRole, RoomType } from '@chat-example/types';
import { EntityManager, QueryOrder } from '@mikro-orm/core';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/postgresql';
import { Injectable, NotFoundException } from '@nestjs/common';
import { RoomResponseDto, RoomUserResponseDto } from '../dto';
import { Room, RoomUser, User } from '../entities';
import { RoomQueryDto, UpdateRoomRequestDto } from './dto';
/**
 * 채팅방 관련 비즈니스 로직을 처리하는 서비스
 */
@Injectable()
export class RoomsService {
  constructor(
    @InjectRepository(Room)
    private readonly roomRepository: EntityRepository<Room>,
    @InjectRepository(RoomUser)
    private readonly roomUserRepository: EntityRepository<RoomUser>,
    @InjectRepository(User)
    private readonly userRepository: EntityRepository<User>,
    private readonly em: EntityManager
  ) {}

  async isOwner({roomId, userId}: {roomId: number, userId: number}): Promise<boolean> {
    const roomUser = await this.roomUserRepository.findOne({
      room: { id: roomId },
      user: { id: userId },
      role: RoomRole.OWNER
    }, { fields: ['id'] });

    return roomUser !== null;
  }

  /**
   * 특정 사용자가 참여 중인 모든 채팅방 목록 조회
   */
  async getUserRooms(userId: number): Promise<RoomResponseDto[]> {
    const roomUsers = await this.roomUserRepository.find(
      { user: { id: userId } }, 
      {orderBy: { room: { updatedAt: QueryOrder.DESC } }, fields: ['room'], populate: ['room'] }
    );

    return await this.formatRoomResponse(roomUsers.map(ru => ru.room), userId);
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
          return existingRoom[0];
        }
      }

      const room = new Room();
      room.name = name || '';
      room.isDirect = isDirect;
      room.isPrivate = isPrivate;
      room.isActive = true;
      room.ownerId = ownerId;
      
      await em.persistAndFlush(room);
      
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
      
      return room;
    });

    return (await this.formatRoomResponse([result], result.ownerId))[0];
  }

  /**
   * 채팅방 정보 조회
   */
  async getRoomById({roomId, userId}: {roomId: number, userId: number}): Promise<RoomResponseDto | null> {
    // Use a direct SQL query to efficiently load room with its users in a single operation
    const room = await this.roomRepository.findOne(
      { id: roomId, isActive: true }
    );

    if (!room) {
      return null;
    }
    
    // Use the roomId to get all roomUsers in one query to avoid N+1 issue
    await this.em.populate(room, ['roomUsers.user']);

    const roomDtos = await this.formatRoomResponse([room], userId);
    return roomDtos[0];
  }
  /**
   * 채팅방의 참여자 목록 조회
   */
  async getRoomUsers(roomId: number): Promise<RoomUserResponseDto[]> {
    const roomUsers = await this.roomUserRepository.find(
      { room: { id: roomId } }, 
      { populate: ['user'] }
    );
    
    return roomUsers.map(roomUser => RoomUserResponseDto.fromEntity(roomUser));
  }

  /**
   * 사용자를 채팅방에 추가
   */
  async addUserToRoom(roomId: number, userId: number): Promise<RoomUser> {
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
      return existingRoomUser;
    }
    
    // Create new RoomUser entity
    const roomUser = new RoomUser();
    roomUser.room = room;
    roomUser.user = user;
    roomUser.joinedAt = new Date();
    roomUser.lastSeenAt = new Date();
    roomUser.role = RoomRole.MEMBER;
    
    await this.em.persistAndFlush(roomUser);
    return roomUser;
  }

  /**
   * 사용자를 채팅방에서 제거
   */
  async removeUserFromRoom(roomId: number, userId: number): Promise<boolean> {
    const result = await this.roomUserRepository.nativeDelete({ room: { id: roomId }, user: { id: userId }});
    await this.em.flush();
    
    return result > 0;
  }

  /**
   * 사용자가 채팅방에 접근할 권한이 있는지 확인
   */
  async canUserJoinRoom({userId, roomId}: {userId: number, roomId: number}): Promise<boolean> {
    const room = await this.roomRepository.findOne({ id: roomId }, { fields: ['ownerId', 'isPrivate', 'isDirect', 'isActive'] });
    if (!room) {
      return false;
    }

    // Check if user is already in the room
    const isUserInRoom = await this.isUserInRoom({userId, roomId});
    
    // If user is not in the room, they can only join public, non-direct rooms
    if (!isUserInRoom) {
      return !room.isPrivate && !room.isDirect && room.isActive;
    }

    return true;
  }

  async isUserInRoom({userId, roomId}: {userId: number, roomId: number}): Promise<boolean> {
    // Use a direct SQL query to check for existence
    const result = await this.roomUserRepository.findOne({
      room: { id: roomId },
      user: { id: userId }
    }, { fields: ['id'] });

    return result !== null;
  }

  /**
   * 채팅방 마지막 읽은 시간 업데이트
   */
  async updateLastSeen(userId: number, roomId: number): Promise<void> {
    const roomUser = await this.roomUserRepository.findOne({
      room: { id: roomId },
      user: { id: userId }
    });
    
    if (roomUser) {
      roomUser.lastSeenAt = new Date();
      await this.em.flush();
    }
  }

  /**
   * 채팅방 목록을 DTO로 변환
   * @private
   */
  private async formatRoomResponse(rooms: Room[], userId: number): Promise<RoomResponseDto[]> {
    if (rooms.length === 0) {
      return [];
    }

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
    const directRooms = rooms.filter(room => room.isDirect);
    const directRoomIds = directRooms.map(room => room.id);

    // Create a map to store otherUsers by roomId
    const otherUsersByRoomId: Record<number, any> = {};

    if (directRoomIds.length > 0) {
      // Get all room users for direct rooms in a single query
      const otherUsersQuery = await this.em.getConnection().execute(`
        SELECT ru.room_id, u.id, u.nickname, u.image_url 
        FROM room_user ru
        JOIN "user" u ON ru.user_id = u.id
        WHERE ru.room_id IN (${directRoomIds.join(',')})
        AND ru.user_id != ${userId}
      `);

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
    if (roomIds.length === 0) {
      return {};
    }
    
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
    const room = await this.roomRepository.findOne({ id: roomId });
    
    if (!room) {
      throw new NotFoundException(`Room with ID ${roomId} not found`);
    }
    
    // Apply updates using the DTO's applyTo method
    updateRoomDto.applyTo(room);
    
    await this.em.flush();
    
    const roomDtos = await this.formatRoomResponse([room], room.ownerId);
    return roomDtos[0];
  }

  /**
   * 채팅방 삭제
   */
  async deleteRoom(roomId: number): Promise<boolean> {
    const room = await this.roomRepository.findOne({ id: roomId });
    
    if (!room) {
      throw new NotFoundException(`Room with ID ${roomId} not found`);
    }
    
    // Soft delete - mark as inactive
    room.isActive = false;
    await this.em.flush();
    
    return true;
  }

  /**
   * 사용자의 채팅방 역할 업데이트
   */
  async updateUserRole(roomId: number, userId: number, role: RoomRole): Promise<RoomUserResponseDto> {
    const roomUser = await this.roomUserRepository.findOne({
      room: { id: roomId },
      user: { id: userId }
    }, { populate: ['user'] });
    
    if (!roomUser) {
      throw new NotFoundException(`User with ID ${userId} not found in room with ID ${roomId}`);
    }
    
    roomUser.role = role;
    await this.em.flush();
    
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
    
    // Get all rooms for the user
    const allRooms = await this.getUserRooms(userId);
    
    // Apply filters
    let filteredRooms = allRooms;
    
    // Filter by type
    if (type === RoomType.DIRECT) {
      filteredRooms = filteredRooms.filter(room => room.isDirect);
    } else if (type === RoomType.GROUP) {
      filteredRooms = filteredRooms.filter(room => !room.isDirect);
    }
    
    // Filter by search term
    if (search) {
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
    
    // Base conditions for public rooms
    const baseConditions = { 
      isPrivate: false, 
      isDirect: false,
      isActive: true
    };
    
    // Apply search filter if provided (in a database-agnostic way)
    if (search) {
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
      
      // Format rooms to DTOs
      const roomDtos = userId 
        ? await this.formatRoomResponse(publicRooms, userId)
        : publicRooms.map(room => RoomResponseDto.fromEntity(room));
      
      return {
        items: roomDtos,
        totalItems,
        page,
        limit
      };
    }
    
    // If no search filter, get all public rooms with pagination
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
    
    // Format rooms to DTOs
    const roomDtos = userId 
      ? await this.formatRoomResponse(publicRooms, userId)
      : publicRooms.map(room => RoomResponseDto.fromEntity(room));
    
    return {
      items: roomDtos,
      totalItems,
      page,
      limit
    };
  }
} 