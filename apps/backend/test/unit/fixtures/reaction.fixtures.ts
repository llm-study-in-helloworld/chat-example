import { EntityManager } from '@mikro-orm/core';
import { MessageReaction, User } from '../../../src/entities';
import { TestMessageData } from './message.fixtures';
import { TestUserData } from './user.fixtures';

export interface CreateReactionOptions {
  emoji?: string;
}

export interface TestReactionData {
  id: number;
  emoji: string;
  messageId: number;
  userId: number;
  createdAt: Date;
  updatedAt: Date;
}

// Common emoji set for testing
export const TEST_EMOJIS = ['👍', '👎', '❤️', '😂', '😢', '🎉', '🔥', '👏', '🤔', '💯'];

/**
 * Creates a message reaction in the database for testing
 */
export async function createReactionFixture(
  em: EntityManager,
  message: TestMessageData,
  user: TestUserData,
  options: CreateReactionOptions = {},
): Promise<TestReactionData> {
  // Default values with overrides from options
  const emoji = options.emoji || TEST_EMOJIS[Math.floor(Math.random() * TEST_EMOJIS.length)];
  
  // Create the reaction entity
  const reaction = new MessageReaction();
  reaction.messageId = message.id;
  reaction.user = await em.findOneOrFail(User, { id: user.id });
  reaction.emoji = emoji;
  
  await em.persistAndFlush(reaction);
  
  // Return reaction data
  return {
    id: reaction.id,
    emoji,
    messageId: message.id,
    userId: user.id,
    createdAt: reaction.createdAt,
    updatedAt: reaction.updatedAt
  };
}

/**
 * Creates multiple reactions for a message in the database for testing
 */
export async function createReactionsFixture(
  em: EntityManager,
  message: TestMessageData,
  users: TestUserData[],
  options: {
    emojiPerUser?: string[];
    randomizeEmoji?: boolean;
  } = {},
): Promise<TestReactionData[]> {
  const reactions: TestReactionData[] = [];
  const { emojiPerUser, randomizeEmoji = false } = options;
  
  for (let i = 0; i < users.length; i++) {
    let emoji: string | undefined;
    
    if (emojiPerUser && emojiPerUser[i]) {
      emoji = emojiPerUser[i];
    } else if (randomizeEmoji) {
      emoji = TEST_EMOJIS[Math.floor(Math.random() * TEST_EMOJIS.length)];
    }
    
    reactions.push(
      await createReactionFixture(em, message, users[i], { emoji })
    );
  }
  
  return reactions;
} 