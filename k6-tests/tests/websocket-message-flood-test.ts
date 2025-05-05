import { randomString } from "https://jslib.k6.io/k6-utils/1.2.0/index.js";
import { check, sleep } from "k6";
import http from "k6/http";
import {
  createRoom,
  getBaseUrls,
  loginUser,
  registerUser,
  Room,
  UserCredentials,
} from "./common/api";
import { extractSocketIOJson } from "./common/websocket";

// Flood test configuration - more aggressive than the stress test
export const options = {
  // More efficient ramp-up pattern that avoids VU initialization limits
  stages: [
    { duration: "10s", target: 20 }, // Quickly ramp up to 20 users
    { duration: "20s", target: 100 }, // Ramp up to 100 users
    { duration: "1m", target: 500 }, // Ramp up to 500 users with high message rate
    { duration: "3m", target: 500 }, // Stay at 500 users for 3 minutes
    { duration: "10s", target: 0 }, // Quick ramp down
  ],
  // Less restrictive thresholds for flood testing
  thresholds: {
    http_req_duration: ["p(95) < 10000"], // Allow up to 10s for 95% of requests
    http_req_failed: ["rate < 0.3"], // Allow up to 30% failure rate
  },
  // Very high rate limit for flood testing
  rps: 5000,
  // Ignore TLS issues for testing
  insecureSkipTLSVerify: true,
};

// Setup function creates a smaller pool but with higher message intent
export function setup() {
  const { API_BASE_URL } = getBaseUrls(true);
  console.log(`Setting up WebSocket flood test against ${API_BASE_URL}`);

  // Small user pool for flood testing
  const userPoolSize = 10;
  console.log(`Creating pool of ${userPoolSize} test users...`);

  // Create test users
  const users = Array(userPoolSize)
    .fill(0)
    .map((_, i) => {
      console.log(`Creating user ${i + 1}/${userPoolSize}...`);
      const user = registerUser(API_BASE_URL);
      if (!user) return null;

      sleep(0.2); // Shorter delay

      const authData = loginUser(API_BASE_URL, user.email, user.password);
      if (!authData) return null;

      return {
        ...user,
        token: authData.token,
        userId: authData.userId,
      };
    })
    .filter(
      (user: UserCredentials | null): user is UserCredentials =>
        !!(user?.token && user?.userId),
    );

  // Create just one room for concentrated message flood
  console.log("Creating a single room for concentrated message flood...");

  const adminUser = users[0];
  if (!adminUser || !adminUser.token) {
    console.error("No admin user available for room creation");
    return { users: [], room: null };
  }

  const room = createRoom(
    API_BASE_URL,
    adminUser.token,
    `FloodTestRoom-${randomString(13)}`,
    false, // not private
    false, // not direct
  );

  if (!room) {
    console.error("Failed to create flood test room");
    return { users: [], room: null };
  }

  console.log(
    `Successfully created flood test room: ${room.name} (${room.id})`,
  );

  return {
    users,
    room,
  };
}

// Main test function - focused on maximum message throughput
export default function (data: {
  users: UserCredentials[];
  room: Room | null;
}) {
  // Get API and WebSocket base URLs
  const { API_BASE_URL, WS_BASE_URL } = getBaseUrls(true);

  // Verify we have data
  if (!data.users || data.users.length === 0 || !data.room) {
    console.error("Missing required test data. Setup failed or incomplete.");
    return;
  }

  // Select user based on VU number (round-robin)
  const userIndex = __VU % data.users.length;
  const user = data.users[userIndex];
  const room = data.room;

  console.log(
    `VU ${__VU}: Using user ${user.nickname} in room ${room.name} (${room.id})`,
  );

  // Step 1: Connect to Socket.io
  const httpBaseUrl = WS_BASE_URL.replace("ws:", "http:").replace(
    "wss:",
    "https:",
  );
  const encodedToken = encodeURIComponent(user.token!);

  // Create handshake URL - we only use polling as it's more reliable for flood testing
  const socketIOHandshakeUrl = `${httpBaseUrl}/socket.io/?EIO=4&transport=polling&t=${Date.now()}&token=${encodedToken}`;

  // Make the handshake request
  const handshakeResponse = http.get(socketIOHandshakeUrl, {
    headers: {
      Authorization: `Bearer ${user.token}`,
    },
    tags: { name: "socketio_handshake" },
  });

  check(handshakeResponse, {
    "Socket.IO handshake successful": (r) => r.status === 200,
  });

  if (
    handshakeResponse.status !== 200 ||
    typeof handshakeResponse.body !== "string"
  ) {
    console.error(`Handshake failed with status ${handshakeResponse.status}`);
    return;
  }

  // Extract session ID
  const handshakeData = extractSocketIOJson(handshakeResponse.body);

  if (!handshakeData || !handshakeData.sid) {
    console.error("Failed to extract Socket.IO session ID");
    return;
  }

  const sid = handshakeData.sid;
  console.log(`Socket.IO session ID: ${sid}`);

  // Join room
  const pollingUrl = `${httpBaseUrl}/socket.io/?EIO=4&transport=polling&sid=${sid}&token=${encodedToken}`;
  const joinRoomPacket = `42["join_room",{"roomId":${room.id}}]`;

  const joinResponse = http.post(pollingUrl, joinRoomPacket, {
    headers: {
      Authorization: `Bearer ${user.token}`,
      "Content-Type": "text/plain",
    },
    tags: { name: "socketio_join_room" },
  });

  check(joinResponse, {
    "Socket.IO join room successful": (r) => r.status === 200,
  });

  if (joinResponse.status !== 200) {
    console.error(`Failed to join room with status ${joinResponse.status}`);
    return;
  }

  // Flood with messages - each VU sends a burst of messages
  const messageCount = 200; // Increased from 100 to 200 messages per VU to compensate for removing iterations
  const batchSize = 10; // Send messages in batches of 10 for better performance

  for (let batch = 0; batch < messageCount / batchSize; batch++) {
    // Create requests array
    const requests = [];

    // Create a batch of messages
    for (let i = 0; i < batchSize; i++) {
      const msgIndex = batch * batchSize + i;
      // Generate a message with VU ID and timestamp for tracking
      const messageText = `Flood test message from VU ${__VU}, msg #${msgIndex}, ts: ${Date.now()}`;

      // Escape quotes for JSON
      const escapedMessage = messageText.replace(/"/g, '\\"');

      // Socket.io message packet
      const messagePacket = `42["new_message",{"roomId":${room.id},"content":"${escapedMessage}"}]`;

      // Add request to array
      requests.push({
        method: "POST",
        url: pollingUrl,
        body: messagePacket,
        headers: {
          Authorization: `Bearer ${user.token}`,
          "Content-Type": "text/plain",
        },
        tags: { name: "socketio_message_batch" },
      });
    }

    // Send batch request
    const responses = http.batch(requests);

    // Check if at least one message succeeded
    let successCount = 0;
    for (const response of responses) {
      if (response.status === 200) {
        successCount++;
      }
    }

    check(null, {
      "Socket.IO message batch partially successful": () => successCount > 0,
      "Socket.IO message batch mostly successful": () =>
        successCount >= batchSize * 0.7,
    });

    // Brief pause between batches (but shorter than before to maintain high throughput)
    sleep(randomIntBetween(5, 20) / 1000);
  }

  // Brief pause between iterations - shorter to increase throughput
  sleep(randomIntBetween(0.5, 1));
}

// Helper function for random integers
function randomIntBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1) + min);
}
