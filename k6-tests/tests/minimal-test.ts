import { check, sleep } from 'k6';
import http from 'k6/http';
import { getBaseUrls } from './common/api';
import { minimalOptions } from './common/options';

export const options = minimalOptions;

export default function() {
  // Get API base URL with HTTPS
  const { API_BASE_URL } = getBaseUrls(true);
  
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