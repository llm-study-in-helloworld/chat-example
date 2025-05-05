import { EntityManager } from "@mikro-orm/core";
import * as bcrypt from "bcrypt";
import { User } from "../../../src/entities";

export interface CreateUserOptions {
  email?: string;
  nickname?: string;
  password?: string;
  imageUrl?: string;
}

export interface TestUserData {
  id: number;
  email: string;
  nickname: string;
  password: string;
  imageUrl?: string;
}

/**
 * Creates a user in the database for testing
 */
export async function createUserFixture(
  em: EntityManager,
  options: CreateUserOptions = {},
): Promise<TestUserData> {
  // Generate a unique identifier for test users
  const uniqueId = `${Date.now()}-${Math.random()
    .toString(36)
    .substring(2, 7)}`;

  // Default values with overrides from options
  const email = options.email || `test-user-${uniqueId}@example.com`;
  const nickname = options.nickname || `TestUser${uniqueId}`;
  const password = options.password || "password123";
  const imageUrl =
    options.imageUrl || `https://example.com/avatars/${uniqueId}.jpg`;

  // Create the user entity
  const user = new User();
  user.email = email;
  user.nickname = nickname;
  user.passwordHash = await bcrypt.hash(password, 10);
  user.imageUrl = imageUrl;

  // Persist to database
  await em.persistAndFlush(user);

  // Return user data
  return {
    id: user.id,
    email,
    nickname,
    password,
    imageUrl,
  };
}

/**
 * Creates multiple users in the database for testing
 */
export async function createUsersFixture(
  em: EntityManager,
  count: number,
  optionsArray: CreateUserOptions[] = [],
): Promise<TestUserData[]> {
  const users: TestUserData[] = [];

  for (let i = 0; i < count; i++) {
    // Use provided options if available, otherwise use empty object
    const options = optionsArray[i] || {};
    users.push(await createUserFixture(em, options));
  }

  return users;
}
