import { Mention } from "./mention";
import { Reaction } from "./reaction";
import { MessageUser } from "./user";

/**
 * Base message interface for common properties
 */
export interface BaseMessage {
  id: number;
  content: string;
  roomId: number;
  senderId: number;
  parentId?: number | null;
}

/**
 * Message type with timestamps and soft delete
 */
export interface Message extends BaseMessage {
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

/**
 * Complete message with relationships
 */
export interface MessageResponse extends Message {
  sender: MessageUser;
  reactions: Reaction[];
  mentions: Mention[];
  isDeleted: boolean;
  replyCount?: number;
}

/**
 * Message creation request
 */
export interface CreateMessageRequest {
  content: string;
  roomId: number;
  parentId?: number;
  mentionedUserIds?: number[];
}

/**
 * Message update request
 */
export interface UpdateMessageRequest {
  content: string;
  mentionedUserIds?: number[];
}
