import { Options } from "k6/options";

/**
 * Minimal test options - very short duration, few users
 */
export const minimalOptions: Options = {
  duration: "7s",
  vus: 2,
  thresholds: {
    http_req_duration: ["p(95)<5000"], // 95% of requests should be below 5s
  },
  insecureSkipTLSVerify: true,
};

/**
 * Simple test options - short duration, moderate users
 */
export const simpleOptions: Options = {
  duration: "10s",
  vus: 10,
  thresholds: {
    http_req_duration: ["p(95)<1000"], // 95% of requests should be below 1s
  },
  insecureSkipTLSVerify: true,
};

/**
 * Realistic test options - moderate load with stages
 */
export const realisticOptions: Options = {
  stages: [
    { duration: "10s", target: 10 },
    { duration: "10s", target: 20 },
    { duration: "10s", target: 30 },
    { duration: "10s", target: 40 },
    { duration: "10s", target: 50 },
    { duration: "10s", target: 60 },
    { duration: "10s", target: 70 },
    { duration: "10s", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<1000"],
    "http_req_duration{type:signup}": ["p(95)<1500"],
    "http_req_duration{type:login}": ["p(95)<1000"],
  },
  insecureSkipTLSVerify: true,
};

/**
 * WebSocket test options - focused on WebSocket performance
 */
export const websocketOptions: Options = {
  stages: [
    { duration: "10s", target: 50 }, // Ramp up to 50 users
    { duration: "30s", target: 100 }, // Slow ramp to 100 users
    { duration: "30s", target: 200 }, // Moderate load
    { duration: "30s", target: 0 }, // Ramp down
  ],
  thresholds: {
    websocket_messages_sent: ["avg < 500"],
    websocket_messages_received: ["avg < 500"],
    websocket_connect_time: ["p(95) < 1000"],
    websocket_connection_errors: ["avg < 1"],
  },
  insecureSkipTLSVerify: true,
};

/**
 * Full load test options - high load with many stages
 */
export const loadOptions: Options = {
  stages: [
    { duration: "30s", target: 100 }, // Ramp up to 100 users
    { duration: "1m", target: 500 }, // Ramp up to 500 users
    { duration: "2m", target: 1000 }, // Ramp up to 1000 users
    { duration: "1m", target: 500 }, // Ramp down to 500 users
    { duration: "30s", target: 0 }, // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"],
    "http_req_duration{type:signup}": ["p(95)<1000"],
    "http_req_duration{type:createRoom}": ["p(95)<800"],
    "http_req_duration{type:joinRoom}": ["p(95)<500"],
    "http_req_duration{type:leaveRoom}": ["p(95)<500"],
  },
  insecureSkipTLSVerify: true,
};

/**
 * Create custom test options with specific duration and VUs
 */
export function createCustomOptions(duration: string, vus: number): Options {
  return {
    duration,
    vus,
    thresholds: {
      http_req_duration: ["p(95)<1000"],
    },
    insecureSkipTLSVerify: true,
  };
}
