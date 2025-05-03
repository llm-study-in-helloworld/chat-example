import { EntityManager } from '@mikro-orm/core';
import { Message, User } from '../../../src/entities';
import { TestRoomData } from './room.fixtures';
import { TestUserData } from './user.fixtures';

export interface CreateMessageOptions {
  content?: string;
  parentId?: number;
  deletedAt?: Date;
}

export interface TestMessageData {
  id: number;
  content: string;
  roomId: number;
  senderId: number;
  parentId?: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
  isDeleted: boolean;
}

/**
 * Creates a message in the database for testing
 */
export async function createMessageFixture(
  em: EntityManager,
  room: TestRoomData,
  sender: TestUserData,
  options: CreateMessageOptions = {},
): Promise<TestMessageData> {
  // Generate a unique identifier for test messages
  const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  
  // Default values with overrides from options
  const content = options.content || `Test message ${uniqueId}`;
  const parentId = options.parentId;
  const deletedAt = options.deletedAt;
  
  // Create the message entity
  const message = new Message();
  message.content = content;
  message.room = room.id;
  message.sender = await em.findOneOrFail(User, { id: sender.id });
  
  if (parentId) {
    message.parent = parentId;
  }
  
  if (deletedAt) {
    message.deletedAt = deletedAt;
  }
  
  await em.persistAndFlush(message);
  
  // Return message data
  return {
    id: message.id,
    content,
    roomId: room.id,
    senderId: sender.id,
    parentId,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
    deletedAt: message.deletedAt,
    isDeleted: !!message.deletedAt
  };
}

/**
 * Creates a reply message to a parent message
 */
export async function createReplyMessageFixture(
  em: EntityManager,
  room: TestRoomData,
  sender: TestUserData,
  parentMessage: TestMessageData,
  options: CreateMessageOptions = {},
): Promise<TestMessageData> {
  // Set reply message options
  const replyOptions: CreateMessageOptions = {
    ...options,
    content: options.content || `Reply to message ${parentMessage.id}`,
    parentId: parentMessage.id
  };
  
  return createMessageFixture(em, room, sender, replyOptions);
}

/**
 * Creates multiple messages in the database for testing
 */
export async function createMessagesFixture(
  em: EntityManager,
  room: TestRoomData,
  sender: TestUserData,
  count: number,
  optionsArray: CreateMessageOptions[] = [],
): Promise<TestMessageData[]> {
  const messages: TestMessageData[] = [];
  
  for (let i = 0; i < count; i++) {
    // Use provided options if available, otherwise use empty object
    const options = optionsArray[i] || {};
    messages.push(await createMessageFixture(em, room, sender, options));
  }
  
  return messages;
}

/**
 * Creates a conversation thread with a parent message and replies
 */
export async function createConversationFixture(
  em: EntityManager,
  room: TestRoomData,
  parentSender: TestUserData,
  repliers: TestUserData[],
  replyCount: number = repliers.length,
  parentOptions: CreateMessageOptions = {},
  replyOptionsArray: CreateMessageOptions[] = [],
): Promise<{
  parentMessage: TestMessageData;
  replies: TestMessageData[];
}> {
  // Create parent message
  const parentMessage = await createMessageFixture(em, room, parentSender, parentOptions);
  
  // Create replies
  const replies: TestMessageData[] = [];
  
  for (let i = 0; i < replyCount; i++) {
    const replierIndex = i % repliers.length;
    const replier = repliers[replierIndex];
    const replyOptions = replyOptionsArray[i] || {};
    
    replies.push(
      await createReplyMessageFixture(em, room, replier, parentMessage, replyOptions)
    );
  }
  
  return {
    parentMessage,
    replies
  };
} 