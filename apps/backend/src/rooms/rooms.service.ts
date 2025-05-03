import { EntityManager, QueryOrder } from '@mikro-orm/core';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { RoomResponseDto } from '../dto';
import { Room, RoomUser, User } from '../entities';
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

  /**
   * 특정 사용자가 참여 중인 모든 채팅방 목록 조회
   */
  async getUserRooms(userId: number): Promise<Room[]> {
    const roomUsers = await this.roomUserRepository.find(
      { user: { id: userId } }, 
      {
        populate: ['room'],
        orderBy: { room: { updatedAt: QueryOrder.DESC } }
      }
    );

    return roomUsers.map(ru => ru.room);
  }

  /**
   * 새로운 채팅방 생성
   */
  async createRoom(
    name: string | undefined,
    isGroup: boolean,
    userIds: number[]
  ): Promise<Room> {
    // 트랜잭션 시작
    return this.em.transactional(async (em) => {
      const room = new Room();
      room.name = name || '';
      room.isGroup = isGroup;
      
      await em.persistAndFlush(room);
      
      // 사용자들을 채팅방에 추가
      for (const userId of userIds) {
        const user = await this.userRepository.findOneOrFail({ id: userId });
        const roomUser = new RoomUser();
        roomUser.room = room;
        roomUser.user = user;
        roomUser.joinedAt = new Date();
        roomUser.lastSeenAt = new Date();
        
        await em.persist(roomUser);
      }
      
      return room;
    });
  }

  /**
   * 채팅방 정보 조회
   */
  async getRoomById(roomId: number): Promise<Room | null> {
    return this.roomRepository.findOne(
      { id: roomId }, 
      { populate: ['roomUsers.user'] }
    );
  }

  /**
   * 채팅방의 참여자 목록 조회
   */
  async getRoomUsers(roomId: number): Promise<User[]> {
    const roomUsers = await this.roomUserRepository.find(
      { room: { id: roomId } }, 
      { populate: ['user'] }
    );
    
    return roomUsers.map(ru => ru.user);
  }

  /**
   * 사용자를 채팅방에 추가
   */
  async addUserToRoom(roomId: number, userId: number): Promise<RoomUser> {
    const room = await this.roomRepository.findOneOrFail({ id: roomId });
    const user = await this.userRepository.findOneOrFail({ id: userId });
    
    // 이미 참여 중인지 확인
    const existingRoomUser = await this.roomUserRepository.findOne({
      room: { id: roomId },
      user: { id: userId }
    });
    
    if (existingRoomUser) {
      return existingRoomUser;
    }
    
    const roomUser = new RoomUser();
    roomUser.room = room;
    roomUser.user = user;
    roomUser.joinedAt = new Date();
    roomUser.lastSeenAt = new Date();
    
    await this.em.persistAndFlush(roomUser);
    return roomUser;
  }

  /**
   * 사용자를 채팅방에서 제거
   */
  async removeUserFromRoom(roomId: number, userId: number): Promise<boolean> {
    const roomUser = await this.roomUserRepository.findOne({
      room: { id: roomId },
      user: { id: userId }
    });
    
    if (!roomUser) {
      return false;
    }
    
    await this.em.removeAndFlush(roomUser);
    return true;
  }

  /**
   * 사용자가 채팅방에 접근할 권한이 있는지 확인
   */
  async canUserJoinRoom(userId: number, roomId: number): Promise<boolean> {
    const roomUser = await this.roomUserRepository.findOne({
      room: { id: roomId },
      user: { id: userId }
    });
    
    return !!roomUser;
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
   */
  async formatRoomResponse(rooms: Room[]): Promise<RoomResponseDto[]> {
    const result: RoomResponseDto[] = [];
    
    for (const room of rooms) {
      const dto = RoomResponseDto.fromEntity(room);
      result.push(dto);
    }
    
    return result;
  }
} 