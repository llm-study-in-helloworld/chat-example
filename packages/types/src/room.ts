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

/**
 * Room type enum for filtering
 */
export enum RoomType {
  DIRECT = 'direct',
  GROUP = 'group',
}

/**
 * Room query parameters for filtering and pagination
 */
export interface RoomQueryParams {
  /**
   * Filter by room type (direct or group)
   */
  type?: RoomType;
  
  /**
   * Search rooms by name
   */
  search?: string;
  
  /**
   * Page number for pagination (1-based)
   */
  page?: number;
  
  /**
   * Number of items per page
   */
  limit?: number;
}

/**
 * Paginated response for room queries
 */
export interface PaginatedRoomsResponse {
  /**
   * List of room items
   */
  items: RoomResponse[];
  
  /**
   * Pagination metadata
   */
  meta: {
    /**
     * Total number of items across all pages
     */
    totalItems: number;
    
    /**
     * Number of items in the current page
     */
    itemCount: number;
    
    /**
     * Number of items per page
     */
    itemsPerPage: number;
    
    /**
     * Total number of pages
     */
    totalPages: number;
    
    /**
     * Current page number
     */
    currentPage: number;
  };
}
