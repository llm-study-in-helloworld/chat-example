import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';
import { check, sleep } from 'k6';
import http from 'k6/http';
import { Trend } from 'k6/metrics';
import { generateRandomSentence } from './utils';

// Custom metrics for WebSocket operations
export const wsMessagesSent = new Trend('websocket_messages_sent');
export const wsMessagesReceived = new Trend('websocket_messages_received');
export const wsConnectTime = new Trend('websocket_connect_time');
export const wsConnectionErrors = new Trend('websocket_connection_errors');

/**
 * Extract the JSON data from a Socket.io packet
 * Socket.io packets are formatted as: <packet type>[<packet data>]
 * For example: 0{"sid":"BExqLt0DlwJ02B87AAAB"}
 */
export function extractSocketIOJson(packet: string | ArrayBuffer | null): any {
  if (!packet || typeof packet !== 'string' || packet.length < 2) return null;
  
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

/**
 * Run a Socket.io chat session with a room
 * Uses Socket.io protocol instead of raw WebSockets
 * 
 * @param wsBaseUrl The WebSocket base URL
 * @param token The authentication token
 * @param roomId The room ID to join
 * @param messageCount Number of messages to send (or random if not specified)
 * @param sessionDuration Maximum session duration in milliseconds
 */
export function runChatSession(
  wsBaseUrl: string, 
  token: string, 
  roomId: string | number,
  messageCount?: number,
  sessionDuration = 20000
): void {
  // Remove any trailing slashes from base URL
  const baseUrl = wsBaseUrl.replace(/\/+$/, '');
  // Ensure the token is properly encoded
  const encodedToken = encodeURIComponent(token);
  
  // Convert roomId to string if it's a number
  const roomIdStr = roomId.toString();
  
  console.log(`Attempting Socket.io connection to join room: ${roomIdStr}`);
  
  // Number of messages to send
  const messagesToSend = messageCount ?? randomIntBetween(3, 8);
  
  try {
    // Step 1: Get Socket.IO handshake via HTTP request (this is how Socket.IO initiates a connection)
    // Convert WebSocket URL to HTTP URL for handshake
    const httpBaseUrl = baseUrl.replace('ws:', 'http:').replace('wss:', 'https:');
    
    // Try both websocket and polling transports
    const transportTypes = ["websocket", "polling"];
    
    // Try different auth methods 
    const authMethods = [
      // Method 1: Token as query parameter (most common)
      { 
        name: "query parameter", 
        urlFormatter: (url: string) => `${url}&token=${encodedToken}`,
        headers: {} as Record<string, string>
      },
      // Method 2: Bearer token in Authorization header
      { 
        name: "Authorization header", 
        urlFormatter: (url: string) => url,
        headers: { 'Authorization': `Bearer ${token}` } as Record<string, string>
      },
      // Method 3: Both header and query parameter
      { 
        name: "header + query", 
        urlFormatter: (url: string) => `${url}&token=${encodedToken}`,
        headers: { 'Authorization': `Bearer ${token}` } as Record<string, string>
      },
      // Method 4: Authorization header with extra auth object
      { 
        name: "header + auth object", 
        urlFormatter: (url: string) => `${url}&auth=${JSON.stringify({token})}`,
        headers: { 'Authorization': `Bearer ${token}` } as Record<string, string>
      },
      // Method 5: Just token without Bearer prefix in header
      { 
        name: "plain token header", 
        urlFormatter: (url: string) => url,
        headers: { 'Authorization': token } as Record<string, string>
      }
    ];
    
    // Try different URL formats
    const socketIoVersions = ["?EIO=4", "?EIO=3"];
    
    // Try different path combinations
    const pathFormats = [
      "",               // Default: /socket.io
      "/ws",            // Common WebSocket endpoint
      "/socket",        // Another common endpoint
      "/socket.io"      // Explicitly specify socket.io
    ];
    
    // Try each combination of transport, auth method, and Socket.io version
    for (const transport of transportTypes) {
      for (const version of socketIoVersions) {
        for (const path of pathFormats) {
          for (const authMethod of authMethods) {
            try {
              console.log(`Trying Socket.IO connection with path: ${path || '/'}, transport: ${transport}, version: ${version}, auth: ${authMethod.name}`);
              
              // Create the Socket.IO handshake URL - make sure the version query string is formatted correctly
              const pathPrefix = path ? path : "/socket.io"; // If empty, use /socket.io
              const socketIOHandshakeUrl = `${httpBaseUrl}${pathPrefix}${version}&transport=${transport}&t=${Date.now()}`;
              const urlWithAuth = authMethod.urlFormatter(socketIOHandshakeUrl);
              
              console.log(`Making Socket.IO handshake request to: ${urlWithAuth.replace(encodedToken, '[TOKEN]')}`);
              
              // Make the handshake request
              const handshakeResponse = http.get(urlWithAuth, {
                headers: authMethod.headers
              });
              
              console.log(`Handshake response status: ${handshakeResponse.status}`);
              
              if (handshakeResponse.status === 200 && typeof handshakeResponse.body === 'string') {
                console.log(`Handshake successful with path: ${path || '/'}, transport: ${transport}, auth: ${authMethod.name}`);
                
                // Extract the Socket.IO session ID from the response
                const handshakeData = extractSocketIOJson(handshakeResponse.body);
                
                if (handshakeData && handshakeData.sid) {
                  console.log(`Socket.IO session ID: ${handshakeData.sid}`);
                  
                  // For polling transport, we use HTTP to send/receive messages
                  const pollingUrl = `${httpBaseUrl}${pathPrefix}${version}&transport=polling&sid=${handshakeData.sid}`;
                  const pollingUrlWithAuth = authMethod.urlFormatter(pollingUrl);
                  
                  // Send a join room event
                  console.log(`Sending join_room event for room ${roomIdStr}...`);
                  
                  // Format: 42["event_name",{data}]
                  // 4 = message type, 2 = packet type for events
                  const joinRoomPacket = `42["join_room",{"roomId":${roomIdStr}}]`;
                  
                  const joinResponse = http.post(pollingUrlWithAuth, joinRoomPacket, {
                    headers: authMethod.headers
                  });
                  console.log(`Join room response status: ${joinResponse.status}`);
                  
                  if (joinResponse.status === 200) {
                    // Send messages
                    for (let i = 0; i < messagesToSend; i++) {
                      const messageText = generateRandomSentence();
                      
                      // Send a message
                      console.log(`Sending message ${i+1}/${messagesToSend}: ${messageText.substring(0, 30)}...`);
                      
                      // Escape quotes to prevent JSON parsing errors
                      const escapedMessage = messageText.replace(/"/g, '\\"');
                      
                      const messagePacket = `42["new_message",{"roomId":${roomIdStr},"content":"${escapedMessage}"}]`;
                      
                      const messageResponse = http.post(pollingUrlWithAuth, messagePacket, {
                        headers: authMethod.headers
                      });
                      console.log(`Message ${i+1} send response status: ${messageResponse.status}`);
                      
                      // For the first message, check if it was successful
                      if (i === 0) {
                        check(messageResponse, {
                          'Socket.IO message send successful': (r) => r.status === 200
                        });
                      }
                      
                      // Wait a bit between messages
                      if (i < messagesToSend - 1) {
                        const waitTime = randomIntBetween(500, 1500);
                        console.log(`Waiting ${waitTime}ms before sending next message...`);
                        sleep(waitTime / 1000); // Convert to seconds for k6 sleep
                      }
                    }
                    
                    // Successfully sent messages, no need to try other transport
                    console.log(`Successfully sent ${messagesToSend} messages via Socket.IO ${transport} at path ${path || '/'}`);
                    wsConnectionErrors.add(0); // Record success
                    return;
                  } else {
                    console.error(`Failed to join room with status ${joinResponse.status}`);
                  }
                } else {
                  console.error('Failed to extract Socket.IO session ID from handshake response');
                }
              } else {
                console.error(`Handshake failed with status ${handshakeResponse.status}`);
              }
            } catch (error) {
              console.error(`Error during Socket.IO ${transport} connection: ${error}`);
            }
          }
        }
      }
    }
    
    // If we reached here, all transports failed
    console.error('All Socket.IO transports failed');
    wsConnectionErrors.add(1);
  } catch (error) {
    console.error(`Exception during Socket.IO connection: ${error}`);
    wsConnectionErrors.add(1);
  }
} 