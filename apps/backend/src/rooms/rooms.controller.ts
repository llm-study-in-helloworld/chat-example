import { RoomRole } from '@chat-example/types';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards
} from '@nestjs/common';
import { CurrentUser, JwtAuthGuard } from '../auth';
import { User } from '../entities';
import { AddUserRequestDto, CreateRoomRequestDto, RoomQueryDto, UpdateRoomRequestDto } from './dto';
import { RoomsService } from './rooms.service';

@UseGuards(JwtAuthGuard)
@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  /**
   * Find all rooms that belong to the current user with optional filtering
   */
  @Get()
  async findAllUsersRoom(
    @CurrentUser() user: User,
    @Query() query: RoomQueryDto
  ) {
    const result = await this.roomsService.getUserRoomsWithFilters(user.id, query);
    
    // Return array of rooms for all other cases
    return result.items;
  }

  /**
   * Search for public rooms that any user can join
   * Returns paginated results with metadata
   */
  @Get('public')
  async findAll(
    @CurrentUser() user: User,
    @Query() query: RoomQueryDto
  ) {
    const result = await this.roomsService.getPublicRooms(query, user.id);
    
    // Return paginated response
    return {
      items: result.items,
      meta: {
        totalItems: result.totalItems,
        itemCount: result.items.length,
        itemsPerPage: result.limit,
        totalPages: Math.ceil(result.totalItems / result.limit),
        currentPage: result.page
      }
    };
  }

  @Get(':id')
  async findOne(@CurrentUser() user: User, @Param('id', ParseIntPipe) roomId: number) {
    const room = await this.roomsService.getRoomById({roomId, userId: user.id});
    if (!room) {
      throw new NotFoundException(`Room with ID ${roomId} not found`);
    }

    // Check if user is in the room
    const isUserInRoom = await this.roomsService.isUserInRoom({userId: user.id, roomId: roomId});
    if (!isUserInRoom) {
      throw new ForbiddenException('You do not have access to this room');
    }

    return room;
  }

  @Post()
  async create(@CurrentUser() user: User, @Body() createRoomDto: CreateRoomRequestDto) {
    // Custom validation
    createRoomDto.validate();

    try {
      const room = await this.roomsService.createRoom({
        name: createRoomDto.name || '',
        isDirect: createRoomDto.isDirect || false,
        userIds: createRoomDto.userIds,
        isPrivate: createRoomDto.isPrivate || false,
        ownerId: user.id,
      });
      
      return room;
    } catch (error: any) {
      // Handle specific errors
      if (error.message && error.message.includes('User not found')) {
        throw new BadRequestException('Invalid user IDs. One or more users do not exist.');
      }
      
      throw error;
    }
  }

  @Post(':id/users')
  async addUser(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() addUserDto: AddUserRequestDto,
  ) {
    const room = await this.roomsService.getRoomById({roomId: id, userId: user.id});
    if (!room) {
      throw new NotFoundException(`Room with ID ${id} not found`);
    }

    // Check if it's a direct message room
    if (room.isDirect) {
      throw new BadRequestException('Cannot add users to direct message rooms');
    }

    const canJoin = await this.roomsService.canUserJoinRoom({userId: user.id, roomId: id});
    if (!canJoin) {
      throw new ForbiddenException('You do not have access to this room');
    }

    await this.roomsService.addUserToRoom(id, addUserDto.userId);
    return { success: true };
  }

  @Delete(':id/users/:userId')
  async removeUser(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    const room = await this.roomsService.getRoomById({roomId: id, userId: user.id});
    if (!room) {
      throw new NotFoundException(`Room with ID ${id} not found`);
    }

    const isUserInRoom = await this.roomsService.isUserInRoom({userId, roomId: id});
    if (!isUserInRoom) {
      throw new ForbiddenException('You do not have access to this room');
    }

    const isOwner = await this.roomsService.isOwner({roomId: id, userId: user.id});
    if (!isOwner) {
      throw new ForbiddenException('You cannot remove the owner from the room');
    }

    const success = await this.roomsService.removeUserFromRoom(id, userId);
    return { success };
  }

  @Delete(':id/leave')
  async leaveRoom(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const room = await this.roomsService.getRoomById({roomId: id, userId: user.id});
    if (!room) {
      throw new NotFoundException(`Room with ID ${id} not found`);
    }

    const isUserInRoom = await this.roomsService.isUserInRoom({userId: user.id, roomId: id});
    if (!isUserInRoom) {
      throw new ForbiddenException('You do not have access to this room');
    }

    const success = await this.roomsService.removeUserFromRoom(id, user.id);
    return { success };
  }

  @Post(':id/seen')
  async updateLastSeen(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const room = await this.roomsService.getRoomById({roomId: id, userId: user.id});
    if (!room) {
      throw new NotFoundException(`Room with ID ${id} not found`);
    }

    const isUserInRoom = await this.roomsService.isUserInRoom({userId: user.id, roomId: id});
    if (!isUserInRoom) {
      throw new ForbiddenException('You do not have access to this room');
    }

    await this.roomsService.updateLastSeen(user.id, id);
    return { success: true };
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateRoomDto: UpdateRoomRequestDto,
  ) {
    const room = await this.roomsService.getRoomById({roomId: id, userId: user.id});
    if (!room) {
      throw new NotFoundException(`Room with ID ${id} not found`);
    }

    const isUserInRoom = await this.roomsService.isUserInRoom({userId: user.id, roomId: id});
    if (!isUserInRoom) {
      throw new ForbiddenException('You do not have access to this room');
    }

    // Only the owner can update the room
    if (room.ownerId !== user.id) {
      throw new ForbiddenException('Only the room owner can update room information');
    }

    const updatedRoom = await this.roomsService.updateRoom(id, updateRoomDto);
    return updatedRoom;
  }

  @Get(':id/users')
  async getRoomUsers(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    const room = await this.roomsService.getRoomById({roomId: id, userId: user.id});
    if (!room) {
      throw new NotFoundException(`Room with ID ${id} not found`);
    }

    const isUserInRoom = await this.roomsService.isUserInRoom({userId: user.id, roomId: id});
    if (!isUserInRoom) {
      throw new ForbiddenException('You do not have access to this room');
    }

    return await this.roomsService.getRoomUsers(id);
  }

  @Patch(':id/users/:userId/role')
  async updateUserRole(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) roomId: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() body: { role: RoomRole }
  ) {
    const room = await this.roomsService.getRoomById({roomId, userId: user.id});
    if (!room) {
      throw new NotFoundException(`Room with ID ${roomId} not found`);
    }

    const isUserInRoom = await this.roomsService.isUserInRoom({userId: user.id, roomId});
    if (!isUserInRoom) {
      throw new ForbiddenException('You do not have access to this room');
    }

    // Only admin can update roles
    if (room.ownerId !== user.id) {
      throw new ForbiddenException('Only the room owner can update user roles');
    }

    const updated = await this.roomsService.updateUserRole(roomId, userId, body.role);
    return updated;
  }

  @Delete(':id')
  async deleteRoom(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    const room = await this.roomsService.getRoomById({roomId: id, userId: user.id});
    if (!room) {
      throw new NotFoundException(`Room with ID ${id} not found`);
    }

    // Only the owner can delete the room
    if (room.ownerId !== user.id) {
      throw new ForbiddenException('Only the room owner can delete the room');
    }

    await this.roomsService.deleteRoom(id);
    return { success: true };
  }
} 