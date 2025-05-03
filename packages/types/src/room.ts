
/**
 * Base room interface for common properties
 */
export interface BaseRoom {
  id: number;
  name: string;
  description?: string;
  imageUrl?: string;
  isPrivate: boolean;
  isDirect?: boolean;
  isActive?: boolean;
  ownerId: number;
}

/**
 * Room type with timestamps
 */
export interface Room extends BaseRoom {
  createdAt: string;
  updatedAt: string;
}

/**
 * Room response with additional information
 */
export interface RoomResponse extends Room {
  unreadCount?: number;
}

/**
 * Room User relationship
 */
export interface RoomUser {
  userId: number;
  roomId: number;
  role: RoomRole;
  joinedAt: string;
}

/**
 * Room User response with user details
 */
export interface RoomUserResponse extends RoomUser {
}

/**
 * Room roles
 */
export enum RoomRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MEMBER = 'member'
}

/**
 * Room creation request
 */
export interface CreateRoomRequest {
  name: string;
  description?: string;
  isPrivate: boolean;
  isDirect: boolean;
  isActive: boolean;
  participantIds?: number[];
}

/**
 * Room update request
 */
export interface UpdateRoomRequest {
  name?: string;
  description?: string;
  imageUrl?: string;
  isPrivate?: boolean;
} 

export interface JoinRoomRequest {
  roomId: number;
}

export interface AddUserRequest {
  userId: number;
}

export interface RemoveUserRequest {
  userId: number;
}
