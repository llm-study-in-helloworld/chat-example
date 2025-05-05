import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';
import { sleep } from 'k6';
import { createRoom, getBaseUrls, loginUser, registerUser, Room, UserCredentials } from './common/api';
import { runChatSession } from './common/websocket';

// Stress test configuration
export const options = {
  // Ramp-up pattern for stress testing
  stages: [
    { duration: '30s', target: 50 },    // Ramp up to 50 users
    { duration: '1m', target: 100 },    // Ramp up to 100 users
    { duration: '2m', target: 200 },    // Ramp up to 200 users
    { duration: '5m', target: 200 },    // Stay at 200 users for 5 minutes
    { duration: '30s', target: 0 },     // Ramp down to 0 users
  ],
  // Conservative thresholds for initial testing
  thresholds: {
    http_req_duration: ['p(95) < 5000'],  // 95% of requests should be below 5s
    http_req_failed: ['rate < 0.1'],      // Less than 10% of requests should fail
    'websocket_connection_errors': ['rate < 0.2'],  // Less than 20% of WebSocket connections should fail
    'websocket_messages_sent': ['avg < 2000'],      // Average message send time under 2s
  },
  // Allow high load without rate limiting
  rps: 500,
  // Insecure TLS for testing
  insecureSkipTLSVerify: true,
};

// Setup function to create a pool of users and rooms
export function setup() {
  const { API_BASE_URL } = getBaseUrls(true); // Use HTTPS URLs as configured
  console.log(`Setting up WebSocket stress test against ${API_BASE_URL}`);
  
  // Create a pool of test users (we'll create fewer than the VU count and reuse them)
  const userPoolSize = 20; // Create 20 users to be shared among VUs
  console.log(`Creating pool of ${userPoolSize} test users...`);
  
  const users = Array(userPoolSize).fill(0).map((_, i) => {
    console.log(`Creating user ${i + 1}/${userPoolSize}...`);
    const user = registerUser(API_BASE_URL);
    if (!user) {
      console.error(`Failed to register user ${i + 1}`);
      return null;
    }
    
    // Delay between user creations to avoid overwhelming the server
    sleep(0.5);
    
    const authData = loginUser(API_BASE_URL, user.email, user.password);
    if (!authData) {
      console.error(`Failed to login as user ${i + 1}`);
      return null;
    }
    
    return {
      ...user,
      token: authData.token,
      userId: authData.userId
    };
  }).filter((user: UserCredentials | null): user is UserCredentials => !!(user?.token && user?.userId));
  
  console.log(`Successfully created ${users.length} test users`);
  
  // Create a pool of rooms
  const roomPoolSize = 5; // Create 5 rooms to distribute load
  console.log(`Creating ${roomPoolSize} test rooms...`);
  
  // Use the first user as admin for all rooms
  const adminUser = users[0];
  if (!adminUser || !adminUser.token) {
    console.error('No admin user available for room creation');
    return { users: [], rooms: [] };
  }
  
  const rooms = Array(roomPoolSize).fill(0).map((_, i) => {
    console.log(`Creating room ${i + 1}/${roomPoolSize}...`);
    const room = createRoom(
      API_BASE_URL,
      adminUser.token!,
      `StressTestRoom-${i + 1}`,
      false, // not private
      false  // not direct
    );
    
    if (!room) {
      console.error(`Failed to create room ${i + 1}`);
      return null;
    }
    
    // Delay between room creations
    sleep(0.5);
    
    return room;
  }).filter((room): room is Room => !!room);
  
  console.log(`Successfully created ${rooms.length} test rooms`);
  
  return {
    users,
    rooms
  };
}

// Main test function - each VU will pick a random user and room
export default function(data: { users: UserCredentials[], rooms: Room[] }) {
  // Get API and WebSocket base URLs with secure flag
  const { API_BASE_URL, WS_BASE_URL } = getBaseUrls(true);
  
  // Verify that we have users and rooms
  if (!data.users || data.users.length === 0) {
    console.error('No test users available. Setup may have failed.');
    return;
  }
  
  if (!data.rooms || data.rooms.length === 0) {
    console.error('No test rooms available. Setup may have failed.');
    return;
  }
  
  // Select random user and room from pools
  // Use modulo with __VU to distribute users and rooms evenly
  const userIndex = (__VU % data.users.length);
  const roomIndex = (__VU % data.rooms.length);
  
  const user = data.users[userIndex];
  const room = data.rooms[roomIndex];
  
  console.log(`VU ${__VU}: Using user ${user.nickname} (${userIndex}) in room ${room.name} (${roomIndex})`);
  
  // Run a WebSocket chat session with randomized message count
  // Higher iteration count means more users but fewer messages each
  // This better simulates real chat behavior where not all users are active
  const messageCount = randomIntBetween(2, 5);
  
  // Run the chat session
  runChatSession(
    WS_BASE_URL,
    user.token!,
    room.id,
    messageCount,
    30000 // 30 second session duration (adjust based on your test needs)
  );
  
  // Random pause between iterations to create more realistic patterns
  sleep(randomIntBetween(1, 5));
} 