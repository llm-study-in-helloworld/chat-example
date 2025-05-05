import {
  randomIntBetween,
  randomString,
} from "https://jslib.k6.io/k6-utils/1.2.0/index.js";
import { check, sleep } from "k6";
import http from "k6/http";
import {
  addUserToRoom,
  createRoom,
  deleteRoom,
  getBaseUrls,
  getPublicRooms,
  getRoom,
  getUserProfile,
  getUserRooms,
  joinRoom,
  loginUser,
  markRoomAsSeen,
  registerUser,
  Room,
  UserCredentials,
} from "./common/api";
import { realisticOptions } from "./common/options";
import { runChatSession } from "./common/websocket";

// Import a helper function to handle Socket.io packet parsing
/**
 * Extract the JSON data from a Socket.io packet
 * Socket.io packets are formatted as: <packet type>[<packet data>]
 * For example: 0{"sid":"BExqLt0DlwJ02B87AAAB"}
 */
function extractSocketIOJson(packet: string | ArrayBuffer | null): any {
  if (!packet || typeof packet !== "string" || packet.length < 2) return null;

  // Find the first character that's not a digit (packet type)
  let dataStart = 0;
  while (dataStart < packet.length && !isNaN(parseInt(packet[dataStart]))) {
    dataStart++;
  }

  // Extract the JSON part
  if (dataStart < packet.length) {
    try {
      return JSON.parse(packet.slice(dataStart));
    } catch (e) {
      console.error(`Failed to parse Socket.io packet: ${e}`);
      return null;
    }
  }
  return null;
}

// Define test options
export const options = realisticOptions;

// Global data for the test
type TestData = {
  users: UserCredentials[];
  rooms: Room[];
  adminUserIndex: number;
};

// Setup function to create test users and rooms
export function setup(): TestData {
  const { API_BASE_URL } = getBaseUrls(true); // Use HTTP by default
  console.log("Setting up test data...");

  // Create users for testing
  console.log("Creating test users...");
  const users = Array(5)
    .fill(0)
    .map((_, i) => {
      console.log(`Creating user ${i + 1}/5...`);
      const user = registerUser(API_BASE_URL);
      if (!user) {
        console.error(`Failed to register user ${i + 1}`);
        return null;
      }

      const authData = loginUser(API_BASE_URL, user.email, user.password);
      if (!authData) {
        console.error(`Failed to login as user ${i + 1}`);
        return null;
      }

      return {
        ...user,
        token: authData.token,
        userId: authData.userId,
      };
    })
    .filter(
      (user: UserCredentials | null): user is UserCredentials =>
        !!(user?.token && user?.userId),
    ) as UserCredentials[];

  if (users.length === 0) {
    console.error("Failed to create any test users");
    return { users: [], rooms: [], adminUserIndex: 0 };
  }

  console.log(`Successfully created ${users.length} test users`);

  // Designate the first user as the admin
  const adminUserIndex = 0;
  const adminUser = users[adminUserIndex];

  // Create rooms owned by the admin user
  console.log("Creating test rooms...");
  const rooms: Room[] = [];

  // Create a public room
  const publicRoom = createRoom(
    API_BASE_URL,
    adminUser.token!,
    `PublicRoom-${randomString(6)}`,
    false, // not private
    false, // not direct
  );

  if (publicRoom) {
    // Store the owner ID for later permission checks
    publicRoom.ownerId = parseInt(adminUser.userId!);
    console.log(
      `Created public room: ${publicRoom.name} (ID: ${publicRoom.id})`,
    );
    rooms.push(publicRoom);

    // Add some users to the public room
    for (let i = 1; i < users.length; i++) {
      const joinSuccess = joinRoom(
        API_BASE_URL,
        users[i].token!,
        publicRoom.id,
      );
      console.log(
        `User ${users[i].nickname} ${
          joinSuccess ? "joined" : "failed to join"
        } public room`,
      );
      sleep(0.5); // Add small delay between join attempts to avoid rate limiting
    }
  }

  // Create a private room
  const privateRoom = createRoom(
    API_BASE_URL,
    adminUser.token!,
    `PrivateRoom-${randomString(6)}`,
    true, // private
    false, // not direct
  );

  if (privateRoom) {
    // Store the owner ID for later permission checks
    privateRoom.ownerId = parseInt(adminUser.userId!);
    console.log(
      `Created private room: ${privateRoom.name} (ID: ${privateRoom.id})`,
    );
    rooms.push(privateRoom);

    // Add some users to the private room (only add a couple)
    const maxUsersToAdd = Math.min(2, users.length - 1);
    for (let i = 1; i <= maxUsersToAdd; i++) {
      if (users[i] && users[i].userId && users[i].token) {
        const addSuccess = addUserToRoom(
          API_BASE_URL,
          adminUser.token!,
          privateRoom.id,
          users[i].userId!,
        );
        console.log(
          `User ${users[i].nickname} ${
            addSuccess ? "added to" : "failed to be added to"
          } private room`,
        );
        sleep(0.5); // Add small delay between add attempts to avoid rate limiting
      }
    }
  }

  // Create a direct message room
  if (users.length > 1) {
    const directRoom = createRoom(
      API_BASE_URL,
      adminUser.token!,
      `DirectRoom-${randomString(6)}`,
      true, // private
      true, // direct
    );

    if (directRoom) {
      // Store the owner ID for later permission checks
      directRoom.ownerId = parseInt(adminUser.userId!);
      console.log(
        `Created direct room: ${directRoom.name} (ID: ${directRoom.id})`,
      );
      rooms.push(directRoom);

      // Add second user to the direct room
      if (users[1] && users[1].userId) {
        const addSuccess = addUserToRoom(
          API_BASE_URL,
          adminUser.token!,
          directRoom.id,
          users[1].userId!,
        );
        console.log(
          `User ${users[1].nickname} ${
            addSuccess ? "added to" : "failed to be added to"
          } direct room`,
        );
      }
    }
  }

  // Wait for all room operations to complete
  sleep(2);

  console.log(
    `Setup completed successfully with ${users.length} users and ${rooms.length} rooms`,
  );

  return {
    users,
    rooms,
    adminUserIndex,
  };
}

// Main test function
export default function (data: TestData) {
  // Get API and WebSocket base URLs - use the default HTTP URLs
  const { API_BASE_URL, WS_BASE_URL } = getBaseUrls(true);
  console.log(`API Base URL: ${API_BASE_URL}`);
  console.log(`WebSocket Base URL: ${WS_BASE_URL}`);

  // Skip test if no users or rooms available
  if (data.users.length === 0 || data.rooms.length === 0) {
    console.log("No users or rooms available, skipping test");
    return;
  }

  try {
    // Select random user and admin
    const adminUser = data.users[data.adminUserIndex];
    const randomUserIndex = (data.adminUserIndex + 1) % data.users.length;
    const randomUser = data.users[randomUserIndex];

    console.log(
      `Test run with admin: ${adminUser.nickname} (${adminUser.userId}) and random user: ${randomUser.nickname} (${randomUser.userId})`,
    );

    // Select a random room
    const randomRoomIndex = Math.floor(Math.random() * data.rooms.length);
    const randomRoom = data.rooms[randomRoomIndex];
    console.log(
      `Selected random room: ${randomRoom?.name || "none"} (${
        randomRoom?.id || "none"
      })`,
    );

    // 1. Get user profile - a basic test that should always work
    if (randomUser && randomUser.token) {
      console.log(`Getting profile for user ${randomUser.nickname}`);
      const profile = getUserProfile(API_BASE_URL, randomUser.token);
      check(profile, {
        "user profile retrieved": (p) =>
          p !== null && p.id.toString() === randomUser.userId,
      });

      // Test only the critical API endpoints that are failing in isolation
      const testType = __ENV.TEST_TYPE || "minimal"; // Default to minimal test

      if (testType === "minimal") {
        // Just create a room and test WebSocket connection
        console.log(`Running minimal test type`);
        testCreateRoomAndWebSocket(API_BASE_URL, WS_BASE_URL, randomUser);
      } else if (testType === "mark_seen") {
        // Test just the mark as seen functionality
        console.log(`Running mark_seen test type`);
        testMarkRoomAsSeen(API_BASE_URL, randomUser);
      } else if (testType === "join_room") {
        // Test just the join room functionality
        console.log(`Running join_room test type`);
        testJoinRoom(API_BASE_URL, randomUser, adminUser);
      } else if (testType === "add_user") {
        // Test just the add user functionality
        console.log(`Running add_user test type`);
        testAddUserToRoom(API_BASE_URL, adminUser, randomUser);
      } else if (testType === "websocket") {
        // Test just the WebSocket functionality in isolation
        console.log(`Running websocket test type`);
        testWebSocketConnections(WS_BASE_URL, randomUser, API_BASE_URL);
      } else {
        // Test everything with high verbosity
        console.log(`Running full test type`);

        // 2. Get user's rooms
        console.log(`Getting rooms for user ${randomUser.nickname}`);
        const userRooms = getUserRooms(API_BASE_URL, randomUser.token);
        check(userRooms, {
          "user rooms retrieved": (r) => r !== null && Array.isArray(r),
        });

        // 3. Get public rooms
        console.log("Getting public rooms");
        const publicRooms = getPublicRooms(API_BASE_URL, randomUser.token);
        check(publicRooms, {
          "public rooms retrieved": (r) => r !== null && Array.isArray(r.items),
        });

        // Run the core test functions
        testCreateRoomAndWebSocket(API_BASE_URL, WS_BASE_URL, randomUser);
        testMarkRoomAsSeen(API_BASE_URL, randomUser);
        testJoinRoom(API_BASE_URL, randomUser, adminUser);
        testAddUserToRoom(API_BASE_URL, adminUser, randomUser);
      }
    }
  } catch (error) {
    console.error("Error during test execution:", error);
  }

  // Sleep between iterations
  sleep(randomIntBetween(1, 3));
}

/**
 * Test creating a room and WebSocket connection
 */
function testCreateRoomAndWebSocket(
  apiBaseUrl: string,
  wsBaseUrl: string,
  user: UserCredentials,
) {
  if (!user.token) return;

  // 4. Create a new room
  console.log(`Creating new test room for user ${user.nickname}`);
  // For the test, make it a public room to ensure we can access it
  const isPrivate = false;
  const newRoom = createRoom(
    apiBaseUrl,
    user.token,
    `TestRoom-${randomString(8)}`,
    isPrivate,
    false, // not direct
  );
  check(newRoom, {
    "new room created": (r) => r !== null,
  });

  if (newRoom) {
    // Store the owner ID for later permission checks
    newRoom.ownerId = parseInt(user.userId!);
    console.log(`Room created: ${newRoom.name} (${newRoom.id})`);

    // Wait a bit to let the room creation finish
    sleep(1);

    // 5. Get room details
    console.log(`Getting details for room ${newRoom.name}`);
    const roomDetails = getRoom(apiBaseUrl, user.token, newRoom.id);
    check(roomDetails, {
      "room details retrieved": (r) => r !== null && r.id === newRoom.id,
    });

    // 8. Try WebSocket connection with different base URLs
    console.log(
      `Trying WebSocket connection to room ${newRoom.name} (${newRoom.id})`,
    );

    // Try all possible WebSocket URLs until one works
    const alternativeWsUrls = [
      wsBaseUrl, // Original URL
      wsBaseUrl.replace("wss:", "ws:"), // Force ws:// instead of wss://
      `${wsBaseUrl}/ws`, // Common /ws endpoint
      `${wsBaseUrl}/socket`, // Common /socket endpoint
    ];

    for (let i = 0; i < alternativeWsUrls.length; i++) {
      try {
        console.log(
          `Trying WebSocket URL ${i + 1}/${alternativeWsUrls.length}: ${
            alternativeWsUrls[i]
          }`,
        );
        runChatSession(
          alternativeWsUrls[i],
          user.token,
          newRoom.id,
          1, // Send just 1 message to test
          3000, // Short session duration
        );
        sleep(1); // Brief pause to let the WebSocket operation complete
      } catch (error) {
        console.error(
          `Error in WebSocket chat session with URL ${alternativeWsUrls[i]}: ${error}`,
        );
      }
    }

    // 12. Clean up: delete the room created by the user
    console.log(`Deleting room ${newRoom.name} (${newRoom.id})`);
    try {
      const deleteSuccess = deleteRoom(apiBaseUrl, user.token, newRoom.id);
      check(null, {
        "room deleted successfully": () => deleteSuccess,
      });
    } catch (error) {
      console.error(`Error deleting room: ${error}`);
    }
  }
}

/**
 * Test mark room as seen functionality
 */
function testMarkRoomAsSeen(apiBaseUrl: string, user: UserCredentials) {
  if (!user.token) return;

  // Create a new room first
  const newRoom = createRoom(
    apiBaseUrl,
    user.token,
    `MarkSeenTest-${randomString(8)}`,
    false, // not private
    false, // not direct
  );

  if (newRoom) {
    console.log(
      `Created room for mark seen test: ${newRoom.name} (${newRoom.id})`,
    );

    // Wait for room creation to complete
    sleep(2);

    // Try to mark the room as seen
    for (let attempt = 1; attempt <= 3; attempt++) {
      console.log(
        `Attempt ${attempt}/3: Marking room ${newRoom.name} (${newRoom.id}) as seen`,
      );
      try {
        const markAsSeen = markRoomAsSeen(apiBaseUrl, user.token, newRoom.id);
        console.log(`Mark as seen result: ${markAsSeen}`);
        check(null, {
          "room marked as seen": () => markAsSeen === true,
        });

        if (markAsSeen) break; // Stop if successful
      } catch (error) {
        console.error(
          `Error marking room as seen (attempt ${attempt}): ${error}`,
        );
      }
      sleep(1); // Wait before trying again
    }

    // Clean up
    deleteRoom(apiBaseUrl, user.token, newRoom.id);
  }
}

/**
 * Test join room functionality
 */
function testJoinRoom(
  apiBaseUrl: string,
  user: UserCredentials,
  adminUser: UserCredentials,
) {
  if (!user.token || !adminUser.token) return;

  // Admin creates a room for the test
  const testRoom = createRoom(
    apiBaseUrl,
    adminUser.token,
    `JoinTest-${randomString(8)}`,
    false, // not private (important)
    false, // not direct
  );

  if (testRoom) {
    console.log(
      `Admin created room for join test: ${testRoom.name} (${testRoom.id})`,
    );

    // Wait for room creation to complete
    sleep(2);

    // Try to join the room with different user
    for (let attempt = 1; attempt <= 3; attempt++) {
      console.log(
        `Attempt ${attempt}/3: User ${user.nickname} joining room ${testRoom.name} (${testRoom.id})`,
      );
      try {
        const joinSuccess = joinRoom(apiBaseUrl, user.token, testRoom.id);
        console.log(`Join room result: ${joinSuccess}`);
        check(null, {
          "joined room successfully": () => joinSuccess === true,
        });

        if (joinSuccess) break; // Stop if successful
      } catch (error) {
        console.error(`Error joining room (attempt ${attempt}): ${error}`);
      }
      sleep(1); // Wait before trying again
    }

    // Clean up
    deleteRoom(apiBaseUrl, adminUser.token, testRoom.id);
  }
}

/**
 * Test add user to room functionality
 */
function testAddUserToRoom(
  apiBaseUrl: string,
  adminUser: UserCredentials,
  userToAdd: UserCredentials,
) {
  if (!adminUser.token || !userToAdd.token || !userToAdd.userId) return;

  // Admin creates a room for the test
  const testRoom = createRoom(
    apiBaseUrl,
    adminUser.token,
    `AddUserTest-${randomString(8)}`,
    true, // make it private to test adding users
    false, // not direct
  );

  if (testRoom) {
    console.log(
      `Admin created room for add user test: ${testRoom.name} (${testRoom.id})`,
    );

    // Wait for room creation to complete
    sleep(2);

    // Try to add the user to the room
    for (let attempt = 1; attempt <= 3; attempt++) {
      console.log(
        `Attempt ${attempt}/3: Adding user ${userToAdd.nickname} (${userToAdd.userId}) to room ${testRoom.name} (${testRoom.id})`,
      );
      try {
        const addSuccess = addUserToRoom(
          apiBaseUrl,
          adminUser.token,
          testRoom.id,
          userToAdd.userId,
        );
        console.log(`Add user result: ${addSuccess}`);
        check(null, {
          "user added to room successfully": () => addSuccess === true,
        });

        if (addSuccess) break; // Stop if successful
      } catch (error) {
        console.error(
          `Error adding user to room (attempt ${attempt}): ${error}`,
        );
      }
      sleep(1); // Wait before trying again
    }

    // Clean up
    deleteRoom(apiBaseUrl, adminUser.token, testRoom.id);
  }
}

/**
 * Test different WebSocket connection formats
 */
function testWebSocketConnections(
  wsBaseUrl: string,
  user: UserCredentials,
  apiBaseUrl: string,
) {
  if (!user.token) return;

  console.log("Testing Socket.io connection with the chat server...");

  // Create a new room for WebSocket testing
  const testRoom = createRoom(
    apiBaseUrl,
    user.token,
    `WSTest-${randomString(8)}`,
    false, // not private
    false, // not direct
  );

  if (!testRoom) {
    console.error("Failed to create room for WebSocket testing");
    return;
  }

  console.log(
    `Created room for WebSocket test: ${testRoom.name} (${testRoom.id})`,
  );
  sleep(1);

  // Convert WebSocket base URL to HTTP base URL for handshake
  const httpBaseUrl = wsBaseUrl
    .replace("ws:", "http:")
    .replace("wss:", "https:");

  // Try connecting via Socket.io protocol
  try {
    // Step 1: Get Socket.IO handshake via HTTP request
    const socketIOHandshakeUrl = `${httpBaseUrl}/socket.io/?EIO=4&transport=polling&t=${Date.now()}`;

    // Method 1: Token as query parameter
    // Add authentication token as query parameter
    const encodedToken = encodeURIComponent(user.token);
    const urlWithAuth = `${socketIOHandshakeUrl}&token=${encodedToken}`;

    console.log(
      `Making Socket.IO handshake request to: ${urlWithAuth.replace(
        encodedToken,
        "[TOKEN]",
      )}`,
    );

    // Make the handshake request with Method 2: Bearer token in Authorization header
    const handshakeResponse = http.get(urlWithAuth, {
      headers: {
        Authorization: `Bearer ${user.token}`,
      },
    });

    console.log(`Handshake response status: ${handshakeResponse.status}`);

    if (
      handshakeResponse.status === 200 &&
      typeof handshakeResponse.body === "string"
    ) {
      console.log(
        `Handshake successful, response: ${handshakeResponse.body.substring(
          0,
          100,
        )}...`,
      );

      // Extract the Socket.IO session ID from the response
      const handshakeData = extractSocketIOJson(handshakeResponse.body);

      if (handshakeData && handshakeData.sid) {
        console.log(`Socket.IO session ID: ${handshakeData.sid}`);

        // For Socket.io polling transport, we can continue sending messages via HTTP
        const pollingUrl = `${httpBaseUrl}/socket.io/?EIO=4&transport=polling&sid=${handshakeData.sid}&token=${encodedToken}`;

        // Send a join room event
        console.log(
          `Sending join_room event for room ${testRoom.id} via polling...`,
        );

        // Format: 42["event_name",{data}]
        const joinRoomPacket = `42["join_room",{"roomId":${testRoom.id}}]`;

        const joinResponse = http.post(pollingUrl, joinRoomPacket, {
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        });
        console.log(`Join room response status: ${joinResponse.status}`);

        // Send a test message
        console.log(
          `Sending test message to room ${testRoom.id} via polling...`,
        );

        const messageText = "Test message from k6 Socket.IO polling test";
        const messagePacket = `42["new_message",{"roomId":${testRoom.id},"content":"${messageText}"}]`;

        const messageResponse = http.post(pollingUrl, messagePacket, {
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        });
        console.log(`Message send response status: ${messageResponse.status}`);

        // Check for success
        check(null, {
          "Socket.IO join room successful (polling)": () =>
            joinResponse.status === 200,
          "Socket.IO message send successful (polling)": () =>
            messageResponse.status === 200,
        });

        console.log("Socket.IO polling test completed");
      } else {
        console.error(
          "Failed to extract Socket.IO session ID from handshake response",
        );
      }
    } else {
      console.error(`Handshake failed with status ${handshakeResponse.status}`);
    }
  } catch (error) {
    console.error(`Error during Socket.IO connection: ${error}`);
  }

  // Clean up: delete the test room
  console.log(`Deleting test room ${testRoom.name} (${testRoom.id})`);
  deleteRoom(apiBaseUrl, user.token, testRoom.id);
}
