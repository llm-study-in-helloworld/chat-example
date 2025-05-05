import { check, sleep } from 'k6';
import http from 'k6/http';
import { Options } from 'k6/options';

// API base URL - connect directly to backend
const API_BASE_URL = `https://${__ENV.API_HOST}:${__ENV.API_PORT}/api`;

export const options: Options = {
  // No stages defined - duration and VUs will be set by command line arguments
  duration: '30s',
  vus: 10,
  stages: [
    { duration: '10s', target: 10 },
    { duration: '10s', target: 20 },
    { duration: '10s', target: 30 },
    { duration: '10s', target: 40 },
    { duration: '10s', target: 50 },
    { duration: '10s', target: 60 },
    { duration: '10s', target: 70 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<5000'], // 95% of requests should be below 5s (very lenient)
  },
  insecureSkipTLSVerify: true, // Skip TLS certificate validation
};

export default function() {
  // Simple health check request
  const res = http.get(`${API_BASE_URL}/health`);
  
  // Print the response details
  console.log(`Status: ${res.status}, Response: ${res.body}`);
  
  // Check if the request was successful with a very lenient check
  check(res, {
    'status is 200': (r) => r.status === 200,
  });
  
  // Shorter pause between iterations
  sleep(1);
} 