import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  UseGuards
} from '@nestjs/common';
import { CurrentUser, JwtAuthGuard } from '../auth';
import { User } from '../entities';
import { AddUserDto, CreateRoomDto } from './dto';
import { RoomsService } from './rooms.service';

@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(@CurrentUser() user: User) {
    const rooms = await this.roomsService.getUserRooms(user.id);
    return this.roomsService.formatRoomResponse(rooms);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async findOne(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    const room = await this.roomsService.getRoomById(id);
    if (!room) {
      throw new NotFoundException(`Room with ID ${id} not found`);
    }

    const canJoin = await this.roomsService.canUserJoinRoom(user.id, id);
    if (!canJoin) {
      throw new ForbiddenException('You do not have access to this room');
    }

    const roomResponse = await this.roomsService.formatRoomResponse([room]);
    return roomResponse[0];
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@CurrentUser() user: User, @Body() createRoomDto: CreateRoomDto) {
    // Make sure the current user is included in the room
    const userIds = new Set(createRoomDto.userIds);
    userIds.add(user.id);

    const room = await this.roomsService.createRoom(
      createRoomDto.name,
      createRoomDto.isGroup,
      Array.from(userIds),
    );

    const roomResponse = await this.roomsService.formatRoomResponse([room]);
    return roomResponse[0];
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/users')
  async addUser(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() addUserDto: AddUserDto,
  ) {
    const room = await this.roomsService.getRoomById(id);
    if (!room) {
      throw new NotFoundException(`Room with ID ${id} not found`);
    }

    const canJoin = await this.roomsService.canUserJoinRoom(user.id, id);
    if (!canJoin) {
      throw new ForbiddenException('You do not have access to this room');
    }

    // Only allow adding users to group rooms
    if (!room.isGroup) {
      throw new ForbiddenException('Cannot add users to a direct message room');
    }

    await this.roomsService.addUserToRoom(id, addUserDto.userId);
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id/users/:userId')
  async removeUser(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    const room = await this.roomsService.getRoomById(id);
    if (!room) {
      throw new NotFoundException(`Room with ID ${id} not found`);
    }

    const canJoin = await this.roomsService.canUserJoinRoom(user.id, id);
    if (!canJoin) {
      throw new ForbiddenException('You do not have access to this room');
    }

    // Users can only remove themselves from a room, unless it's a group and future implementation
    // for admin/moderator roles
    if (userId !== user.id) {
      throw new ForbiddenException('You can only remove yourself from a room');
    }

    const success = await this.roomsService.removeUserFromRoom(id, userId);
    return { success };
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/seen')
  async updateLastSeen(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const room = await this.roomsService.getRoomById(id);
    if (!room) {
      throw new NotFoundException(`Room with ID ${id} not found`);
    }

    const canJoin = await this.roomsService.canUserJoinRoom(user.id, id);
    if (!canJoin) {
      throw new ForbiddenException('You do not have access to this room');
    }

    await this.roomsService.updateLastSeen(user.id, id);
    return { success: true };
  }
} 