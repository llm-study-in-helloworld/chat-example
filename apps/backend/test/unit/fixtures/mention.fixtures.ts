import { EntityManager } from "@mikro-orm/core";
import { Mention, Message, User } from "../../../src/entities";
import { TestMessageData } from "./message.fixtures";
import { TestUserData } from "./user.fixtures";

export interface TestMentionData {
  id: number;
  messageId: number;
  userId: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Creates a mention in the database for testing
 */
export async function createMentionFixture(
  em: EntityManager,
  message: TestMessageData,
  mentionedUser: TestUserData,
): Promise<TestMentionData> {
  // Create the mention entity
  const mention = new Mention();
  mention.messageId = message.id;
  mention.mentionedUser = await em.findOneOrFail(User, {
    id: mentionedUser.id,
  });

  await em.persistAndFlush(mention);

  // Return mention data
  return {
    id: mention.id,
    messageId: message.id,
    userId: mentionedUser.id,
    createdAt: mention.createdAt,
    updatedAt: mention.updatedAt,
  };
}

/**
 * Creates multiple mentions in the database for testing
 */
export async function createMentionsFixture(
  em: EntityManager,
  message: TestMessageData,
  mentionedUsers: TestUserData[],
): Promise<TestMentionData[]> {
  const mentions: TestMentionData[] = [];

  for (const user of mentionedUsers) {
    mentions.push(await createMentionFixture(em, message, user));
  }

  return mentions;
}

/**
 * Updates a message content to include @mentions for the specified users
 */
export async function addMentionsToMessageContent(
  em: EntityManager,
  message: TestMessageData,
  mentionedUsers: TestUserData[],
): Promise<TestMessageData> {
  // Create mentions string
  const mentionsString = mentionedUsers
    .map((user) => `@${user.nickname}`)
    .join(" ");

  // Update message content to include mentions
  const updatedContent = `${message.content} ${mentionsString}`;

  // Update message in database
  const messageEntity = await em.findOneOrFail(Message, { id: message.id });
  messageEntity.content = updatedContent;
  await em.flush();

  // Create mention entities
  const mentions = await createMentionsFixture(em, message, mentionedUsers);

  // Return updated message data
  return {
    ...message,
    content: updatedContent,
  };
}
