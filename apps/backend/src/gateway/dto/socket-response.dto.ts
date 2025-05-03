import { MessageReactionResponseDto } from "@app/dto";

/**
 * Base response DTO for socket events
 */
export class SocketResponseBaseDto {
  success?: boolean;
  error?: string;
}

/**
 * DTO for successful socket responses
 */
export class SocketSuccessDto extends SocketResponseBaseDto {
  success: boolean = true;
}

/**
 * DTO for error socket responses
 */
export class SocketErrorDto extends SocketResponseBaseDto {
  error: string = '';
}

/**
 * DTO for reaction responses
 */
export class ReactionResponseDto extends SocketSuccessDto {
  added: boolean = false;
  reaction: MessageReactionResponseDto | null = null;
}

/**
 * DTO for reaction update events
 */
export class ReactionUpdateEventDto {
  messageId: number = 0;
  reactions: MessageReactionResponseDto[] = [];
}

/**
 * DTO for user presence events
 */
export class UserPresenceEventDto {
  userId: number = 0;
  status: 'online' | 'offline' = 'offline';
} 