import { check, sleep } from 'k6';
import http from 'k6/http';

// Define environment variable types
interface Env {
  API_HOST: string;
  API_PORT: string;
}

// Get environment variables with type safety
const env = {
  API_HOST: __ENV.API_HOST || 'localhost',
  API_PORT: __ENV.API_PORT || '3000'
} as Env;

// API base URL
const API_BASE_URL = `https://${env.API_HOST}:${env.API_PORT}/api`;

export const options = {
  // No stages defined - duration and VUs will be set by command line arguments
  duration: '10s',
  vus: 10,
  thresholds: {
    http_req_duration: ['p(95)<1000'], // 95% of requests should be below 1s
  },
  insecureSkipTLSVerify: true, // Skip TLS certificate validation
};

export default function() {
  // Simple health check request
  const res = http.get(`${API_BASE_URL}/health`);
  
  // Check if the request was successful
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  // Brief sleep
  sleep(0.5);
} 