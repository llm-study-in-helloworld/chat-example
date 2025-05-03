import { MessageUser } from './user';

/**
 * Base mention interface for common properties
 */
export interface BaseMention {
  id: number;
  messageId: number;
  userId: number;
}

/**
 * Mention type with timestamps
 */
export interface Mention extends BaseMention {
  createdAt: string;
}

/**
 * Mention response with user details
 */
export interface MentionResponse extends Mention {
  mentionedUser: MessageUser;
} 