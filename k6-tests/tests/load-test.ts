import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.6.0/index.js';
import { sleep } from 'k6';
import {
  createRoom,
  getBaseUrls,
  joinRoom,
  kickUser,
  leaveRoom,
  loginUser,
  registerUser,
  Room,
  UserCredentials
} from './common/api';
import { loadOptions } from './common/options';
import { runChatSession } from './common/websocket';

// Define test options
export const options = loadOptions;

// Global variables for storing test data
let testUsers: UserCredentials[] = [];
let testRooms: Room[] = [];

// Setup function to create initial users and rooms
export function setup() {
  const { API_BASE_URL } = getBaseUrls(true);
  
  // Create users for testing
  console.log('Setting up test users...');
  testUsers = Array(10).fill(0).map((_, i) => {
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
      token: authData.token,
      userId: authData.userId
    };
  }).filter(Boolean) as UserCredentials[];
  
  console.log(`Created ${testUsers.length} test users`);
  
  // Create rooms for testing
  console.log('Setting up test rooms...');
  if (testUsers.length > 0) {
    testRooms = Array(5).fill(0).map((_, i) => {
      const randomUserIndex = Math.floor(Math.random() * testUsers.length);
      const token = testUsers[randomUserIndex].token as string;
      
      const room = createRoom(
        API_BASE_URL, 
        token, 
        `TestRoom${i}`, 
        i % 3 === 0, // Every third room is private
        i % 5 === 0  // Every fifth room is direct
      );
      
      return room;
    }).filter(Boolean) as Room[];
    
    console.log(`Created ${testRooms.length} test rooms`);
  }
  
  return {
    users: testUsers,
    rooms: testRooms
  };
}

// Helper function to get a random user from the test users
function getRandomUser(testUsers: UserCredentials[]): UserCredentials {
  return testUsers[Math.floor(Math.random() * testUsers.length)];
}

// Helper function to get a random room from the test rooms
function getRandomRoom(testRooms: Room[]): Room {
  return testRooms[Math.floor(Math.random() * testRooms.length)];
}

// Main test function
export default function(data: { users: UserCredentials[], rooms: Room[] }) {
  // Get base URLs
  const { API_BASE_URL, WS_BASE_URL } = getBaseUrls(true);
  
  // Use pre-created users and rooms from setup
  testUsers = data.users;
  testRooms = data.rooms;
  
  // Skip test if no users or rooms available
  if (testUsers.length === 0 || testRooms.length === 0) {
    console.log('No users or rooms available, skipping test');
    return;
  }
  
  // Get a random user and room
  const user = getRandomUser(testUsers);
  const randomRoom = getRandomRoom(testRooms);
  
  if (user && user.token) {
    // Join a random room
    joinRoom(API_BASE_URL, user.token, randomRoom.id);
    sleep(randomIntBetween(1, 2));
    
    // Send messages in the room via WebSocket
    runChatSession(
      WS_BASE_URL,
      user.token,
      randomRoom.id,
      randomIntBetween(1, 5),
      3000
    );
    sleep(randomIntBetween(1, 3));
    
    // Leave the room
    leaveRoom(API_BASE_URL, user.token, randomRoom.id);
    
    // Create another room for this specific test
    const createdRoom = createRoom(API_BASE_URL, user.token);
    if (createdRoom) {
      // Kick a random user from created room (if you're the owner)
      const randomUserId = getRandomUser(testUsers).userId || '1';
      kickUser(API_BASE_URL, user.token, createdRoom.id, randomUserId);
    }
  }

  // Pause between test iterations
  sleep(randomIntBetween(1, 2));
} 