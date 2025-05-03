import {
  SocketResponseBaseDto,
  SocketSuccessDto,
  SocketErrorDto,
  MessageReactionDto,
  ReactionResponseDto,
  ReactionUpdateEventDto,
  UserPresenceEventDto
} from './socket-response.dto';

describe('Socket Response DTOs', () => {
  describe('SocketSuccessDto', () => {
    it('should have success property set to true', () => {
      const dto = new SocketSuccessDto();
      expect(dto.success).toBe(true);
    });
  });

  describe('SocketErrorDto', () => {
    it('should have error property initialized', () => {
      const dto = new SocketErrorDto();
      expect(dto.error).toBe('');
    });

    it('should allow setting error message', () => {
      const dto = new SocketErrorDto();
      dto.error = 'Test error message';
      expect(dto.error).toBe('Test error message');
    });
  });

  describe('ReactionResponseDto', () => {
    it('should extend SocketSuccessDto', () => {
      const dto = new ReactionResponseDto();
      expect(dto.success).toBe(true);
      expect(dto).toBeInstanceOf(SocketSuccessDto);
    });

    it('should have required properties initialized', () => {
      const dto = new ReactionResponseDto();
      expect(dto.added).toBe(false);
      expect(dto.reaction).toBeNull();
    });
  });

  describe('ReactionUpdateEventDto', () => {
    it('should have required properties initialized', () => {
      const dto = new ReactionUpdateEventDto();
      expect(dto.messageId).toBe(0);
      expect(dto.reactions).toEqual([]);
    });
  });

  describe('UserPresenceEventDto', () => {
    it('should have required properties initialized', () => {
      const dto = new UserPresenceEventDto();
      expect(dto.userId).toBe(0);
      expect(dto.status).toBe('offline');
    });
  });
}); 