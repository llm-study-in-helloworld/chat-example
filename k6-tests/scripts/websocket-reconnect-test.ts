import { randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';
import { check, sleep } from 'k6';
import http from 'k6/http';
import { createRoom, getBaseUrls, loginUser, registerUser, Room, UserCredentials } from './common/api';
import { extractSocketIOJson } from './common/websocket';

// Reconnection test configuration
export const options = {
  // Lower VU count but longer duration for reconnection testing
  stages: [
    { duration: '30s', target: 10 },    // Ramp up to only 10 users
    { duration: '10m', target: 10 },    // Stay at 10 users for 10 minutes to test reconnections
    { duration: '30s', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95) < 5000'],  // 95% of requests should be below 5s
    http_req_failed: ['rate < 0.2'],      // Allow up to 20% failure rate for reconnects
  },
  insecureSkipTLSVerify: true,
};

// Setup function
export function setup() {
  const { API_BASE_URL } = getBaseUrls(true);
  console.log(`Setting up WebSocket reconnection test against ${API_BASE_URL}`);
  
  // Create a small number of users for reconnection testing
  const userPoolSize = 5;
  console.log(`Creating pool of ${userPoolSize} test users...`);
  
  const users = Array(userPoolSize).fill(0).map((_, i) => {
    console.log(`Creating user ${i + 1}/${userPoolSize}...`);
    const user = registerUser(API_BASE_URL);
    if (!user) return null;
    
    sleep(0.5);
    
    const authData = loginUser(API_BASE_URL, user.email, user.password);
    if (!authData) return null;
    
    return {
      ...user,
      token: authData.token,
      userId: authData.userId
    };
  }).filter((user: UserCredentials | null): user is UserCredentials => !!(user?.token && user?.userId));
  
  // Create a couple of rooms
  console.log('Creating rooms for reconnection testing...');
  
  const adminUser = users[0];
  if (!adminUser || !adminUser.token) {
    console.error('No admin user available for room creation');
    return { users: [], rooms: [] };
  }
  
  const rooms = Array(2).fill(0).map((_, i) => {
    console.log(`Creating room ${i + 1}/2...`);
    const room = createRoom(
      API_BASE_URL,
      adminUser.token!,
      `ReconnectTestRoom-${i + 1}-${randomString(4)}`,
      false, // not private
      false  // not direct
    );
    
    if (!room) {
      console.error(`Failed to create room ${i + 1}`);
      return null;
    }
    
    sleep(0.5);
    
    return room;
  }).filter((room): room is Room => !!room);
  
  console.log(`Successfully created ${rooms.length} rooms for reconnection testing`);
  
  return {
    users,
    rooms
  };
}

// Main test function - focuses on connection, disconnection, and reconnection
export default function(data: { users: UserCredentials[], rooms: Room[] }) {
  // Get API and WebSocket base URLs
  const { API_BASE_URL, WS_BASE_URL } = getBaseUrls(true);
  
  // Verify we have data
  if (!data.users || data.users.length === 0 || !data.rooms || data.rooms.length === 0) {
    console.error('Missing required test data. Setup failed or incomplete.');
    return;
  }
  
  // Select user and room based on VU number
  const userIndex = (__VU % data.users.length);
  const roomIndex = (__VU % data.rooms.length);
  
  const user = data.users[userIndex];
  const room = data.rooms[roomIndex];
  
  console.log(`VU ${__VU}: Using user ${user.nickname} in room ${room.name} (${room.id})`);
  
  // The number of connection cycles to perform
  const reconnectionCycles = 3;
  
  for (let cycle = 1; cycle <= reconnectionCycles; cycle++) {
    console.log(`VU ${__VU}: Starting connection cycle ${cycle}/${reconnectionCycles}`);
    
    // Connect to Socket.io
    const httpBaseUrl = WS_BASE_URL.replace('ws:', 'http:').replace('wss:', 'https:');
    const encodedToken = encodeURIComponent(user.token!);
    
    // Create handshake URL
    const socketIOHandshakeUrl = `${httpBaseUrl}/socket.io/?EIO=4&transport=polling&t=${Date.now()}&token=${encodedToken}`;
    
    // Make the handshake request
    const handshakeResponse = http.get(socketIOHandshakeUrl, {
      headers: {
        'Authorization': `Bearer ${user.token}`
      },
      tags: { name: 'socketio_handshake', cycle: cycle.toString() }
    });
    
    check(handshakeResponse, {
      [`Socket.IO handshake successful (cycle ${cycle})`]: (r) => r.status === 200
    });
    
    if (handshakeResponse.status !== 200 || typeof handshakeResponse.body !== 'string') {
      console.error(`Handshake failed with status ${handshakeResponse.status} in cycle ${cycle}`);
      // Even on failure, continue to the next cycle after a pause
      sleep(5);
      continue;
    }
    
    // Extract session ID
    const handshakeData = extractSocketIOJson(handshakeResponse.body);
    
    if (!handshakeData || !handshakeData.sid) {
      console.error(`Failed to extract Socket.IO session ID in cycle ${cycle}`);
      sleep(5);
      continue;
    }
    
    const sid = handshakeData.sid;
    console.log(`VU ${__VU}: Socket.IO session ID for cycle ${cycle}: ${sid}`);
    
    // Join room
    const pollingUrl = `${httpBaseUrl}/socket.io/?EIO=4&transport=polling&sid=${sid}&token=${encodedToken}`;
    const joinRoomPacket = `42["join_room",{"roomId":${room.id}}]`;
    
    const joinResponse = http.post(pollingUrl, joinRoomPacket, {
      headers: {
        'Authorization': `Bearer ${user.token}`,
        'Content-Type': 'text/plain'
      },
      tags: { name: 'socketio_join_room', cycle: cycle.toString() }
    });
    
    check(joinResponse, {
      [`Socket.IO join room successful (cycle ${cycle})`]: (r) => r.status === 200
    });
    
    if (joinResponse.status !== 200) {
      console.error(`Failed to join room with status ${joinResponse.status} in cycle ${cycle}`);
      sleep(5);
      continue;
    }
    
    // Activity period - send a couple of messages and keep the connection alive
    const activePhaseMessages = 3;
    
    for (let i = 0; i < activePhaseMessages; i++) {
      // Generate a message with cycle and message info for tracking
      const messageText = `Reconnect test message from VU ${__VU}, cycle ${cycle}, msg ${i+1}/${activePhaseMessages}`;
      
      // Escape quotes for JSON
      const escapedMessage = messageText.replace(/"/g, '\\"');
      
      // Socket.io message packet
      const messagePacket = `42["new_message",{"roomId":${room.id},"content":"${escapedMessage}"}]`;
      
      // Send message
      const messageResponse = http.post(pollingUrl, messagePacket, {
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'text/plain'
        },
        tags: { name: 'socketio_message', cycle: cycle.toString() }
      });
      
      check(messageResponse, {
        [`Socket.IO message ${i+1} sent successfully (cycle ${cycle})`]: (r) => r.status === 200
      });
      
      // Wait between messages
      sleep(randomIntBetween(1, 3));
    }
    
    // Simulate connection activity without sending messages (just polling)
    // This simulates the client maintaining an open connection
    console.log(`VU ${__VU}: Maintaining connection for cycle ${cycle}...`);
    
    // Socket.io requires clients to send polling requests to keep the connection alive
    const pollCount = 3;
    for (let i = 0; i < pollCount; i++) {
      // Simple polling request to keep connection alive
      const pollResponse = http.get(`${pollingUrl}&t=${Date.now()}`, {
        headers: { 'Authorization': `Bearer ${user.token}` },
        tags: { name: 'socketio_poll', cycle: cycle.toString() }
      });
      
      check(pollResponse, {
        [`Socket.IO polling successful ${i+1}/${pollCount} (cycle ${cycle})`]: (r) => r.status === 200
      });
      
      // Wait longer between polls
      sleep(randomIntBetween(3, 8));
    }
    
    // Now we simulate a disconnection (letting the connection timeout)
    // In a real app, this could be due to network issues, server restart, etc.
    console.log(`VU ${__VU}: Simulating disconnection for cycle ${cycle}...`);
    
    // Wait long enough for the connection to time out (typically 30-60s for Socket.io defaults)
    // We use a shorter time to speed up the test
    const disconnectionTime = randomIntBetween(15, 30);
    sleep(disconnectionTime);
    
    // After disconnect, we'll start a new cycle
    console.log(`VU ${__VU}: Completed cycle ${cycle}/${reconnectionCycles}`);
  }
  
  // After all reconnection cycles, we finalize 
  console.log(`VU ${__VU}: Completed all ${reconnectionCycles} reconnection cycles`);
}

// Helper function for random integers
function randomIntBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1) + min);
} 