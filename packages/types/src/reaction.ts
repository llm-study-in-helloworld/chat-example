import { MessageUser } from "./user";

/**
 * Base reaction interface for common properties
 */
export interface BaseReaction {
  id: number;
  emoji: string;
  messageId: number;
  userId: number;
}

/**
 * Reaction type with timestamps
 */
export interface Reaction extends BaseReaction {
  createdAt: string;
}

/**
 * Reaction response with user details
 */
export interface ReactionResponse extends Reaction {
  user: MessageUser;
}

/**
 * Reaction creation request
 */
export interface CreateReactionRequest {
  emoji: string;
  messageId: number;
}

/**
 * Reaction update request
 */
export interface UpdateReactionRequest {
  emoji: string;
}
