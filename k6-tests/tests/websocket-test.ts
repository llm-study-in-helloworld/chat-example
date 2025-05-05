import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';
import { sleep } from 'k6';
import { createRoom, getBaseUrls, kickUser, loginUser, registerUser, Room, UserCredentials } from './common/api';
import { websocketOptions } from './common/options';
import { runChatSession } from './common/websocket';

// Test settings - make sure thresholds are properly defined for Trend metrics
export const options = {
  ...websocketOptions,
  thresholds: {
    // Use proper aggregation methods for Trend metrics (avg, min, max, med, p)
    'websocket_connection_errors': ['avg < 1'], // Using average instead of count
    'websocket_messages_sent': ['avg < 2000'], // Ensure messages are sent quickly
    'websocket_messages_received': ['avg < 2000'], // Ensure messages are received quickly
  }
};

// Setup function to create users and rooms before testing
export function setup() {
  const { API_BASE_URL } = getBaseUrls(true); // Use HTTP/WS by default (not HTTPS/WSS)
  
  // Create test users
  console.log('Setting up test users for WebSocket test...');
  const users = Array(10).fill(0).map((_, i) => {
    const user = registerUser(API_BASE_URL);
    if (!user) {
      return null;
    }
    
    const authData = loginUser(API_BASE_URL, user.email, user.password);
    if (!authData) {
      return null;
    }
    
    return {
      ...user,
      token: authData.token!,
      userId: authData.userId
    };
  }).filter((user: UserCredentials | null): user is UserCredentials => !!(user?.token && user?.userId)) as UserCredentials[];
  
  console.log(`Created ${users.length} test users for WebSocket test`);
  
  // Create rooms with different configurations
  console.log('Setting up test rooms for WebSocket test...');
  const rooms: Room[] = [];
  
  if (users.length > 0) {
    // Create standard chat rooms
    const standardRooms = Array(3).fill(0).map((_, i) => {
      const randomUserIndex = Math.floor(Math.random() * users.length);
      const token = users[randomUserIndex].token!;
      
      return createRoom(
        API_BASE_URL, 
        token, 
        `ChatRoom-${i}`,
        false,  // not private
        false   // not direct
      );
    }).filter(Boolean) as Room[];
    
    // Create private rooms
    const privateRooms = Array(2).fill(0).map((_, i) => {
      const randomUserIndex = Math.floor(Math.random() * users.length);
      const token = users[randomUserIndex].token!;
      
      return createRoom(
        API_BASE_URL, 
        token, 
        `PrivateRoom-${i}`,
        true,   // private
        false   // not direct
      );
    }).filter(Boolean) as Room[];
    
    // Create direct message rooms
    const directRooms = Array(2).fill(0).map((_, i) => {
      const randomUserIndex = Math.floor(Math.random() * users.length);
      const token = users[randomUserIndex].token!;
      
      return createRoom(
        API_BASE_URL, 
        token, 
        `DirectRoom-${i}`,
        true,   // private
        true    // direct
      );
    }).filter(Boolean) as Room[];
    
    rooms.push(...standardRooms, ...privateRooms, ...directRooms);
    console.log(`Created ${rooms.length} test rooms for WebSocket test (${standardRooms.length} standard, ${privateRooms.length} private, ${directRooms.length} direct)`);
  }
  
  // Return the prepared test data
  return {
    users,
    rooms
  };
}

// Main test function
export default function(data: { users: UserCredentials[], rooms: Room[] }) {
  // Get API and WebSocket base URLs - use default URLs
  const { API_BASE_URL, WS_BASE_URL } = getBaseUrls(true);
  
  // Skip if no predefined test data is available
  if (!data.users || data.users.length === 0 || !data.rooms || data.rooms.length === 0) {
    console.log('No predefined test data available, creating data on the fly');
    
    // Step 1: Register a new user
    const newUser = registerUser(API_BASE_URL);
    if (!newUser) return;
    
    sleep(1);
    
    // Step 2: Login with the newly registered user
    const authData = loginUser(API_BASE_URL, newUser.email, newUser.password);
    if (!authData) return;
    
    sleep(1);
    
    // Step 3: Create a new chat room
    const room = createRoom(API_BASE_URL, authData.token);
    if (!room) return;
    
    sleep(1);
    
    // Step 4: Start a WebSocket chat session using Socket.io protocol
    console.log(`Starting Socket.io chat session with new user in room ${room.id}`);
    runChatSession(
      WS_BASE_URL,
      authData.token,
      room.id,
      randomIntBetween(3, 5), // Send 3-5 messages to reduce test time
      10000 // Session duration: 10 seconds
    );
  } else {
    // Use pre-defined test data
    const randomUserIndex = Math.floor(Math.random() * data.users.length);
    const user = data.users[randomUserIndex];
    
    const randomRoomIndex = Math.floor(Math.random() * data.rooms.length);
    const room = data.rooms[randomRoomIndex];
    
    console.log(`Using predefined data: User ${user.nickname} in room ${room.name}`);
    
    // Start a Socket.io chat session with predefined user and room
    runChatSession(
      WS_BASE_URL,
      user.token!,
      room.id,
      randomIntBetween(3, 8), // Send 3-8 messages
      10000 // Session duration: 10 seconds
    );
    
    // Occasionally test kicking a user (only if room owner)
    if (Math.random() > 0.7) {
      // Get another random user to kick
      const userToKickIndex = (randomUserIndex + 1) % data.users.length; // Just pick a different user
      const userToKick = data.users[userToKickIndex];
      
      if (userToKick && userToKick.userId) {
        console.log(`Attempting to kick user ${userToKick.nickname} from room ${room.name}`);
        kickUser(API_BASE_URL, user.token!, room.id, userToKick.userId);
      }
    }
  }
  
  // Wait for session to complete and messages to be processed
  sleep(randomIntBetween(3, 5));
} 