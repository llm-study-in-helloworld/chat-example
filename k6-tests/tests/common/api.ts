import { check } from "k6";
import http from "k6/http";
import { AuthResponse } from "../../../packages/types";
import { generateRandomEmail, generateRandomNickname } from "./utils";

// Types
export interface UserCredentials {
  email: string;
  nickname: string;
  password: string;
  token?: string;
  userId?: string;
}

export interface Room {
  id: string;
  name: string;
  isPrivate: boolean;
  isDirect: boolean;
  ownerId?: number;
  [key: string]: any;
}

export interface UserProfile {
  id: number;
  email: string;
  nickname: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: any;
}

// Base URL construction helper
export function getBaseUrls(isSecure = false) {
  const API_HOST = __ENV.API_HOST || "nginx";
  const API_PORT = __ENV.API_PORT || "5002";
  const WS_HOST = __ENV.WS_HOST || API_HOST;
  const WS_PORT = __ENV.WS_PORT || API_PORT;

  const HTTP_PROTOCOL = isSecure ? "https" : "http";
  const WS_PROTOCOL = isSecure ? "wss" : "ws";

  return {
    API_BASE_URL: `${HTTP_PROTOCOL}://${API_HOST}:${API_PORT}/api`,
    WS_BASE_URL: `${WS_PROTOCOL}://${WS_HOST}:${WS_PORT}`,
  };
}

/**
 * Register a new user
 * @param apiBaseUrl The base URL for API calls
 * @returns User credentials if successful, null otherwise
 */
export function registerUser(apiBaseUrl: string): UserCredentials | null {
  const email = generateRandomEmail();
  const nickname = generateRandomNickname();
  const password = "Password123!";

  const payload = JSON.stringify({
    email,
    nickname,
    password,
  });

  const res = http.post(`${apiBaseUrl}/auth/signup`, payload, {
    headers: { "Content-Type": "application/json" },
    tags: { type: "signup" },
  });

  check(res, {
    "registered successfully": (r) => r.status === 201,
  });

  if (res.status !== 201) {
    console.error(`Registration failed: ${res.status} ${res.body}`);
    return null;
  }

  return {
    email,
    nickname,
    password,
  };
}

/**
 * Login a user
 * @param apiBaseUrl The base URL for API calls
 * @param email The user's email
 * @param password The user's password
 * @returns Token and user ID if successful, null otherwise
 */
export function loginUser(
  apiBaseUrl: string,
  email: string,
  password: string,
): { token: string; userId: string } | null {
  const payload = JSON.stringify({
    email,
    password,
  });

  const res = http.post(`${apiBaseUrl}/auth/login`, payload, {
    headers: { "Content-Type": "application/json" },
    tags: { type: "login" },
  });

  check(res, {
    "logged in successfully": (r) => r.status === 201,
  });

  if (res.status !== 201) {
    console.error(`Login failed: ${res.status} ${res.body}`);
    return null;
  }

  const data = res.json() as unknown as AuthResponse;
  return {
    token: data.token,
    userId: data.user.id.toString(),
  };
}

/**
 * Get user profile
 * @param apiBaseUrl The base URL for API calls
 * @param token The authorization token
 * @returns User profile data if successful, null otherwise
 */
export function getUserProfile(
  apiBaseUrl: string,
  token: string,
): UserProfile | null {
  const res = http.get(`${apiBaseUrl}/users/me`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    tags: { type: "getUserProfile" },
  });

  check(res, {
    "get user profile successful": (r) => r.status === 200,
  });

  if (res.status !== 200) {
    console.error(`Get user profile failed: ${res.status} ${res.body}`);
    return null;
  }

  return res.json() as UserProfile;
}

/**
 * Update user profile
 * @param apiBaseUrl The base URL for API calls
 * @param token The authorization token
 * @param updateData Data to update (nickname)
 * @returns Updated user profile if successful, null otherwise
 */
export function updateUserProfile(
  apiBaseUrl: string,
  token: string,
  updateData: { nickname?: string },
): UserProfile | null {
  const payload = JSON.stringify(updateData);

  const res = http.patch(`${apiBaseUrl}/users/profile`, payload, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    tags: { type: "updateUserProfile" },
  });

  check(res, {
    "update user profile successful": (r) => r.status === 200,
  });

  if (res.status !== 200) {
    console.error(`Update user profile failed: ${res.status} ${res.body}`);
    return null;
  }

  return res.json() as UserProfile;
}

/**
 * Create a new room
 * @param apiBaseUrl The base URL for API calls
 * @param token The authorization token
 * @param name Optional room name
 * @param isPrivate Whether the room is private
 * @param isDirect Whether it's a direct message room
 * @returns Room object if successful, null otherwise
 */
export function createRoom(
  apiBaseUrl: string,
  token: string,
  name?: string,
  isPrivate = false,
  isDirect = false,
): Room | null {
  const roomName =
    name || `Room-${Math.random().toString(36).substring(2, 10)}`;

  const payload = JSON.stringify({
    name: roomName,
    isPrivate,
    isDirect,
    userIds: [],
  });

  const res = http.post(`${apiBaseUrl}/rooms`, payload, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    tags: { type: "createRoom" },
  });

  check(res, {
    "room created successfully": (r) => r.status === 201,
  });

  if (res.status !== 201) {
    console.error(`Create room failed: ${res.status} ${res.body}`);
    return null;
  }

  return res.json() as Room;
}

/**
 * Get room details by ID
 * @param apiBaseUrl The base URL for API calls
 * @param token The authorization token
 * @param roomId The room ID
 * @returns Room details if successful, null otherwise
 */
export function getRoom(
  apiBaseUrl: string,
  token: string,
  roomId: string | number,
): Room | null {
  try {
    console.log(
      `Getting room ${roomId} details from URL: ${apiBaseUrl}/rooms/${roomId}`,
    );

    const res = http.get(`${apiBaseUrl}/rooms/${roomId}`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      tags: { type: "getRoom" },
    });

    // Only consider 2xx responses as successful
    const success = res.status >= 200 && res.status < 300;

    if (!success) {
      console.error(`Get room failed: ${res.status} ${res.body}`);
      check(res, {
        "get room successful": (r) => r.status >= 200 && r.status < 300,
      });
      return null;
    }

    check(res, {
      "get room successful": (r) => r.status >= 200 && r.status < 300,
    });

    console.log(`Successfully retrieved room ${roomId} details`);

    return res.json() as Room;
  } catch (error) {
    console.error(`Exception getting room details: ${error}`);
    return null;
  }
}

/**
 * Get all rooms for the current user
 * @param apiBaseUrl The base URL for API calls
 * @param token The authorization token
 * @returns Array of rooms if successful, null otherwise
 */
export function getUserRooms(apiBaseUrl: string, token: string): Room[] | null {
  const res = http.get(`${apiBaseUrl}/rooms`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    tags: { type: "getUserRooms" },
  });

  check(res, {
    "get user rooms successful": (r) => r.status === 200,
  });

  if (res.status !== 200) {
    console.error(`Get user rooms failed: ${res.status} ${res.body}`);
    return null;
  }

  return res.json() as Room[];
}

/**
 * Get public rooms that can be joined
 * @param apiBaseUrl The base URL for API calls
 * @param token The authorization token
 * @returns Array of public rooms if successful, null otherwise
 */
export function getPublicRooms(
  apiBaseUrl: string,
  token: string,
): { items: Room[]; meta: any } | null {
  const res = http.get(`${apiBaseUrl}/rooms/public`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    tags: { type: "getPublicRooms" },
  });

  check(res, {
    "get public rooms successful": (r) => r.status === 200,
  });

  if (res.status !== 200) {
    console.error(`Get public rooms failed: ${res.status} ${res.body}`);
    return null;
  }

  return res.json() as { items: Room[]; meta: any };
}

/**
 * Join a room
 * @param apiBaseUrl The base URL for API calls
 * @param token The authorization token
 * @param roomId The room ID to join
 * @returns Success status
 */
export function joinRoom(
  apiBaseUrl: string,
  token: string,
  roomId: string | number,
): boolean {
  try {
    console.log(
      `Joining room ${roomId} at URL: ${apiBaseUrl}/rooms/${roomId}/join`,
    );

    // The room join API might have changed or need different parameters
    // Try different approaches based on backend implementation

    // Some APIs require a body even if it's empty
    const payload = JSON.stringify({});

    const res = http.post(`${apiBaseUrl}/rooms/${roomId}/join`, payload, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      tags: { type: "joinRoom" },
    });

    // Many APIs return 200 for success, but sometimes 201 for created or other codes are used
    const success = res.status >= 200 && res.status < 300;

    if (!success) {
      console.error(`Join room failed: ${res.status} ${res.body}`);
    } else {
      console.log(`Successfully joined room ${roomId}`);
    }

    check(res, {
      "join room successful": (r) => r.status >= 200 && r.status < 300,
    });

    return success;
  } catch (error) {
    console.error(`Exception joining room: ${error}`);
    return false;
  }
}

/**
 * Add a user to a room
 * @param apiBaseUrl The base URL for API calls
 * @param token The authorization token
 * @param roomId The room ID
 * @param userId The user ID to add
 * @returns Success status
 */
export function addUserToRoom(
  apiBaseUrl: string,
  token: string,
  roomId: string | number,
  userId: string | number,
): boolean {
  try {
    console.log(
      `Adding user ${userId} to room ${roomId} at URL: ${apiBaseUrl}/rooms/${roomId}/users`,
    );

    // Try different payload formats as the API might expect different formats
    // Format 1: Single userId field
    const payload1 = JSON.stringify({
      userId: parseInt(userId.toString()),
    });

    // Format 2: User ID array
    const payload2 = JSON.stringify({
      userIds: [parseInt(userId.toString())],
    });

    // Use format 1 for this attempt
    const payload = payload1;

    // Log the payload for debugging
    console.log(`Request payload: ${payload}`);

    const res = http.post(`${apiBaseUrl}/rooms/${roomId}/users`, payload, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      tags: { type: "addUserToRoom" },
    });

    // Many APIs return 200 for success, but sometimes 201 for created or other codes are used
    const success = res.status >= 200 && res.status < 300;

    if (!success) {
      console.error(`Add user to room failed: ${res.status} ${res.body}`);
    } else {
      console.log(`Successfully added user ${userId} to room ${roomId}`);
    }

    check(res, {
      "add user to room successful": (r) => r.status >= 200 && r.status < 300,
    });

    return success;
  } catch (error) {
    console.error(`Exception adding user to room: ${error}`);
    return false;
  }
}

/**
 * Mark room as seen (update last seen timestamp)
 * @param apiBaseUrl The base URL for API calls
 * @param token The authorization token
 * @param roomId The room ID
 * @returns Success status
 */
export function markRoomAsSeen(
  apiBaseUrl: string,
  token: string,
  roomId: string | number,
): boolean {
  try {
    console.log(
      `Marking room ${roomId} as seen with URL: ${apiBaseUrl}/rooms/${roomId}/seen`,
    );

    // Try with an empty payload as some APIs require a body even if it's empty
    const payload = JSON.stringify({});

    const res = http.post(`${apiBaseUrl}/rooms/${roomId}/seen`, payload, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      tags: { type: "markRoomAsSeen" },
    });

    // Many APIs return 200 for success, but sometimes 204 for no content or other codes are used
    const success = res.status >= 200 && res.status < 300;

    if (!success) {
      console.error(`Mark room as seen failed: ${res.status} ${res.body}`);
    } else {
      console.log(
        `Successfully marked room ${roomId} as seen with status ${res.status}`,
      );
    }

    check(res, {
      "mark room as seen successful": (r) => r.status >= 200 && r.status < 300,
    });

    return success;
  } catch (error) {
    console.error(`Exception marking room as seen: ${error}`);
    return false;
  }
}

/**
 * Leave a room
 * @param apiBaseUrl The base URL for API calls
 * @param token The authorization token
 * @param roomId The room ID to leave
 * @returns Success status
 */
export function leaveRoom(
  apiBaseUrl: string,
  token: string,
  roomId: string | number,
): boolean {
  const res = http.del(`${apiBaseUrl}/rooms/${roomId}/leave`, null, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    tags: { type: "leaveRoom" },
  });

  check(res, {
    "leave room successful": (r) => r.status === 200,
  });

  return res.status === 200;
}

/**
 * Get users in a room
 * @param apiBaseUrl The base URL for API calls
 * @param token The authorization token
 * @param roomId The room ID
 * @returns Array of users if successful, null otherwise
 */
export function getRoomUsers(
  apiBaseUrl: string,
  token: string,
  roomId: string | number,
): UserProfile[] | null {
  const res = http.get(`${apiBaseUrl}/rooms/${roomId}/users`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    tags: { type: "getRoomUsers" },
  });

  check(res, {
    "get room users successful": (r) => r.status === 200,
  });

  if (res.status !== 200) {
    console.error(`Get room users failed: ${res.status} ${res.body}`);
    return null;
  }

  return res.json() as UserProfile[];
}

/**
 * Kick a user from a room
 * @param apiBaseUrl The base URL for API calls
 * @param token The authorization token of room owner
 * @param roomId The room ID
 * @param userId The user ID to kick
 * @returns Success status
 */
export function kickUser(
  apiBaseUrl: string,
  token: string,
  roomId: string | number,
  userId: string | number,
): boolean {
  const res = http.del(`${apiBaseUrl}/rooms/${roomId}/users/${userId}`, null, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    tags: { type: "kickUser" },
  });

  check(res, {
    "kick user successful": (r) => r.status === 200,
  });

  return res.status === 200;
}

/**
 * Update a room's details
 * @param apiBaseUrl The base URL for API calls
 * @param token The authorization token of room owner
 * @param roomId The room ID
 * @param updateData Room data to update
 * @returns Updated room if successful, null otherwise
 */
export function updateRoom(
  apiBaseUrl: string,
  token: string,
  roomId: string | number,
  updateData: { name?: string; isPrivate?: boolean },
): Room | null {
  const payload = JSON.stringify(updateData);

  const res = http.patch(`${apiBaseUrl}/rooms/${roomId}`, payload, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    tags: { type: "updateRoom" },
  });

  check(res, {
    "update room successful": (r) => r.status === 200,
  });

  if (res.status !== 200) {
    console.error(`Update room failed: ${res.status} ${res.body}`);
    return null;
  }

  return res.json() as Room;
}

/**
 * Delete a room
 * @param apiBaseUrl The base URL for API calls
 * @param token The authorization token of room owner
 * @param roomId The room ID to delete
 * @returns Success status
 */
export function deleteRoom(
  apiBaseUrl: string,
  token: string,
  roomId: string | number,
): boolean {
  const res = http.del(`${apiBaseUrl}/rooms/${roomId}`, null, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    tags: { type: "deleteRoom" },
  });

  check(res, {
    "delete room successful": (r) => r.status === 200,
  });

  return res.status === 200;
}
