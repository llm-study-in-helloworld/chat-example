import { RoomRole } from "@chat-example/types";
import { EntityManager } from "@mikro-orm/core";
import { Room, RoomUser, User } from "../../../src/entities";
import { TestUserData } from "./user.fixtures";

export interface CreateRoomOptions {
  name?: string;
  description?: string;
  imageUrl?: string;
  isPrivate?: boolean;
  isDirect?: boolean;
  isActive?: boolean;
}

export interface TestRoomData {
  id: number;
  name: string;
  description?: string;
  imageUrl?: string;
  isPrivate: boolean;
  isDirect: boolean;
  isActive: boolean;
  ownerId: number;
  memberIds: number[];
}

/**
 * Creates a room in the database for testing
 */
export async function createRoomFixture(
  em: EntityManager,
  owner: TestUserData,
  members: TestUserData[] = [],
  options: CreateRoomOptions = {},
): Promise<TestRoomData> {
  // Generate a unique identifier for test rooms
  const uniqueId = `${Date.now()}-${Math.random()
    .toString(36)
    .substring(2, 7)}`;

  // Default values with overrides from options
  const name = options.name || `Test Room ${uniqueId}`;
  const description =
    options.description || `Test room description ${uniqueId}`;
  const imageUrl =
    options.imageUrl || `https://example.com/rooms/${uniqueId}.jpg`;
  const isPrivate = options.isPrivate !== undefined ? options.isPrivate : false;
  const isDirect = options.isDirect !== undefined ? options.isDirect : false;
  const isActive = options.isActive !== undefined ? options.isActive : true;

  // Create the room entity
  const room = new Room();
  room.name = name;
  room.description = description;
  room.imageUrl = imageUrl;
  room.isPrivate = isPrivate;
  room.isDirect = isDirect;
  room.isActive = isActive;
  room.ownerId = owner.id;

  await em.persistAndFlush(room);

  // Add owner as a member
  const ownerRoomUser = new RoomUser();
  ownerRoomUser.room = room;
  ownerRoomUser.user = await em.findOneOrFail(User, { id: owner.id });
  ownerRoomUser.joinedAt = new Date();
  ownerRoomUser.lastSeenAt = new Date();
  ownerRoomUser.role = RoomRole.OWNER;

  await em.persist(ownerRoomUser);

  // Add additional members
  const memberIds: number[] = [owner.id];

  for (const member of members) {
    const memberRoomUser = new RoomUser();
    memberRoomUser.room = room;
    memberRoomUser.user = await em.findOneOrFail(User, { id: member.id });
    memberRoomUser.joinedAt = new Date();
    memberRoomUser.lastSeenAt = new Date();
    memberRoomUser.role = RoomRole.MEMBER;

    await em.persist(memberRoomUser);
    memberIds.push(member.id);
  }

  await em.flush();

  // Return room data
  return {
    id: room.id,
    name,
    description,
    imageUrl,
    isPrivate,
    isDirect,
    isActive,
    ownerId: owner.id,
    memberIds,
  };
}

/**
 * Creates a direct message room between two users
 */
export async function createDirectRoomFixture(
  em: EntityManager,
  user1: TestUserData,
  user2: TestUserData,
  options: CreateRoomOptions = {},
): Promise<TestRoomData> {
  // Set direct message room options
  const dmOptions: CreateRoomOptions = {
    ...options,
    isDirect: true,
    name: options.name || `DM ${user1.nickname} & ${user2.nickname}`,
  };

  return createRoomFixture(em, user1, [user2], dmOptions);
}

/**
 * Creates multiple rooms in the database for testing
 */
export async function createRoomsFixture(
  em: EntityManager,
  owner: TestUserData,
  count: number,
  members: TestUserData[] = [],
  optionsArray: CreateRoomOptions[] = [],
): Promise<TestRoomData[]> {
  const rooms: TestRoomData[] = [];

  for (let i = 0; i < count; i++) {
    // Use provided options if available, otherwise use empty object
    const options = optionsArray[i] || {};
    rooms.push(await createRoomFixture(em, owner, members, options));
  }

  return rooms;
}
