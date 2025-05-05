import { randomIntBetween, randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';
import { check, sleep } from 'k6';
import http from 'k6/http';

// Define types
interface SignupResponse {
  email: string;
  password: string;
  status: number;
  body: any;
}

interface LoginResponse {
  status: number;
  body: any;
}

// Get environment variables
const API_HOST: string = __ENV.API_HOST || 'backend';  // Use service name in Docker network
const API_PORT: string = __ENV.API_PORT || '3000';

// Simple faker replacement functions
function generateRandomEmail(): string {
  return `test.${randomString(8)}@example.com`;
}

function generateRandomNickname(): string {
  return `user_${randomString(6)}`;
}

// 테스트 설정
export const options = {
  stages: [
    { duration: '10s', target: 10 },   // 10명 사용자로 증가
    { duration: '10s', target: 20 },   // 20명 사용자로 증가
    { duration: '10s', target: 30 },   // 30명 사용자로 증가
    { duration: '10s', target: 40 },   // 40명 사용자로 증가
    { duration: '10s', target: 50 },   // 50명 사용자로 증가
    { duration: '10s', target: 60 },   // 60명 사용자로 증가
    { duration: '10s', target: 70 },   // 70명 사용자로 증가
    { duration: '10s', target: 80 },   // 80명 사용자로 증가
    { duration: '10s', target: 90 },   // 90명 사용자로 증가
    { duration: '10s', target: 100 },   // 100명 사용자로 증가
    { duration: '10s', target: 0 },    // 점진적으로 감소
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'], // 95% 요청이 1000ms 미만
    'http_req_duration{type:signup}': ['p(95)<1500'], // 회원가입 API 성능
    'http_req_duration{type:login}': ['p(95)<1000'],  // 로그인 API 성능
  },
  insecureSkipTLSVerify: true, // Skip TLS certificate validation
};

// API 기본 URL
const API_BASE_URL = `http://${API_HOST}:${API_PORT}/api`;

// 사용자 회원가입 함수
function signUp(): SignupResponse {
  const email = generateRandomEmail();
  const nickname = generateRandomNickname();
  const password = 'password123';

  const payload = {
    email,
    nickname,
    password,
  };

  console.log(`Signing up user: ${email} with nickname: ${nickname}`);
  
  const res = http.post(`${API_BASE_URL}/auth/signup`, JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
    tags: { type: 'signup' },
  });

  check(res, {
    'signup status is 201': (r) => r.status === 201,
  });

  if (res.status !== 201) {
    console.error(`Signup failed with status ${res.status}: ${res.body}`);
  } else {
    console.log(`Signup successful: ${res.body}`);
  }

  return {
    email,
    password,
    status: res.status,
    body: res.body ? res.json() : null
  };
}

// 로그인 함수
function login(email: string, password: string): LoginResponse {
  const payload = {
    email: email,
    password: password,
  };

  console.log(`Attempting login for: ${email}`);
  
  const res = http.post(`${API_BASE_URL}/auth/login`, JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
    tags: { type: 'login' },
  });

  check(res, {
    'login status is 200': (r) => r.status === 200,
  });

  if (res.status !== 200) {
    console.error(`Login failed with status ${res.status}: ${res.body}`);
  } else {
    console.log(`Login successful: ${email}`);
  }

  return {
    status: res.status,
    body: res.body ? res.json() : null,
  };
}

// 실행할 시나리오 함수
export default function() {
  // 시나리오 1: 회원가입
  const userInfo = signUp();
  sleep(randomIntBetween(1, 2));
  
  // 시나리오 2: 로그인 (회원가입 성공 시)
  if (userInfo.status === 201) {
    const loginResult = login(userInfo.email, userInfo.password);
    
    // 성공 및 응답 확인
    if (loginResult.status === 200 && loginResult.body) {
      console.log(`전체 로그인 응답: ${JSON.stringify(loginResult.body)}`);
    }
  }

  // 테스트 사이에 짧은 휴식
  sleep(randomIntBetween(1, 3));
} 