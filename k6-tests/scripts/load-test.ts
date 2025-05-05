import { randomIntBetween, randomItem, randomString } from 'https://jslib.k6.io/k6-utils/1.6.0/index.js';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import http from 'k6/http';
import ws from 'k6/ws';

// Define types
interface User {
  id: number;
  email: string;
  password: string;
  nickname: string;
  token: string | null;
}

interface Room {
  id: number;
  name: string;
  ownerId: number;
}

interface CreatedUser {
  email: string;
  nickname: string;
  password: string;
  token?: string;
  id?: number;
}

interface CreatedRoom {
  id: number;
  name: string;
  isPrivate: boolean;
  isDirect: boolean;
  [key: string]: any;
}

// Get environment variables
const API_HOST: string = __ENV.API_HOST || 'nginx';
const API_PORT: string = __ENV.API_PORT || '5002';

// Simple faker replacement functions
function generateRandomEmail(): string {
  return `test.${randomString(8)}@example.com`;
}

function generateRandomNickname(): string {
  return `user_${randomString(6)}`;
}

function generateRandomSentence(): string {
  const sentences: string[] = [
    "Hello, how are you doing today?",
    "This is a test message for load testing.",
    "I'm testing the WebSocket functionality.",
    "Let's see how the system handles this message.",
    "Random message for testing purposes.",
    "Testing the chat application under load.",
    "Just another test message.",
    "How's the system performance looking?",
    "Testing, testing, 1, 2, 3.",
    "This is message number " + Math.floor(Math.random() * 1000) + ".",
  ];
  return randomItem(sentences);
}

// 테스트 설정
export const options = {
  stages: [
    { duration: '30s', target: 100 }, // 점진적으로 100명 사용자로 증가
    { duration: '1m', target: 500 },  // 500명 사용자로 증가
    { duration: '2m', target: 1000 }, // 1,000명 사용자로 증가
    { duration: '1m', target: 5000 }, // 5,000명 사용자로 증가 
    { duration: '1m', target: 10000 },// 10,000명 사용자로 증가
    { duration: '30s', target: 0 },   // 점진적으로 감소
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% 요청이 500ms 미만
    'http_req_duration{type:signup}': ['p(95)<1000'], // 회원가입 API 성능
    'http_req_duration{type:createRoom}': ['p(95)<800'], // 방 생성 API 성능
    'http_req_duration{type:joinRoom}': ['p(95)<500'], // 방 참여 API 성능
    'http_req_duration{type:leaveRoom}': ['p(95)<500'], // 방 나가기 API 성능
    'http_req_duration{type:kickUser}': ['p(95)<500'], // 사용자 강퇴 API 성능
  },
  insecureSkipTLSVerify: true, // Skip TLS certificate validation
};

// 이미 생성된 사용자 정보를 저장하는 배열
const users = new SharedArray('users', function (): User[] {
  return Array(100).fill(0).map((_, i) => ({
    id: i + 1, // 가상의 ID
    email: `test${i}@example.com`,
    password: 'password123',
    nickname: `TestUser${i}`,
    token: null,
  }));
});

// 이미 생성된 방 정보를 저장하는 배열
const rooms = new SharedArray('rooms', function (): Room[] {
  return Array(20).fill(0).map((_, i) => ({
    id: i + 1, // 가상의 ID
    name: `TestRoom${i}`,
    ownerId: (i % users.length) + 1,
  }));
});

// API 기본 URL
const API_BASE_URL = `https://${API_HOST}:${API_PORT}/api`;
const WS_BASE_URL = `wss://${API_HOST}:${API_PORT}`;

// 랜덤한 항목 선택 함수
function randomUser(): User {
  return randomItem(users);
}

function randomRoom(): Room {
  return randomItem(rooms);
}

// 사용자 회원가입 함수
function signUp(): CreatedUser | null {
  const email = generateRandomEmail();
  const nickname = generateRandomNickname();
  const password = 'password123';

  const payload = {
    email,
    nickname,
    password,
  };

  const res = http.post(`${API_BASE_URL}/auth/signup`, JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
    tags: { type: 'signup' },
  });

  check(res, {
    'signup successful': (r) => r.status === 201,
  });

  if (res.status === 201) {
    return {
      email,
      nickname,
      password,
      ...JSON.parse(res.body as any),
    };
  }
  
  return null;
}

// 로그인 함수
function login(user: CreatedUser): string | null {
  const payload = {
    email: user.email,
    password: user.password,
  };

  const res = http.post(`${API_BASE_URL}/auth/login`, JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
    tags: { type: 'login' },
  });

  check(res, {
    'login successful': (r) => r.status === 201,
  });

  if (res.status === 201) {
    const body = (res.json()) as { token: string };
    return body.token;
  }
  
  return null;
}

// 채팅방 생성 함수
function createRoom(token: string): CreatedRoom | null {
  const roomName = `Room-${randomString(8)}`;
  const isPrivate = Math.random() > 0.5;
  const isDirect = Math.random() > 0.8;

  const payload = {
    name: roomName,
    isPrivate,
    isDirect,
    userIds: [], // 초기에는 비어있게
  };

  const res = http.post(`${API_BASE_URL}/rooms`, JSON.stringify(payload), {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    tags: { type: 'createRoom' },
  });

  check(res, {
    'create room successful': (r) => r.status === 201,
  });

  if (res.status === 201) {
    return JSON.parse(res.body as any);
  }
  
  return null;
}

// 채팅방 참여 함수
function joinRoom(token: string, roomId: number): boolean {
  const res = http.post(`${API_BASE_URL}/rooms/${roomId}/join`, null, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    tags: { type: 'joinRoom' },
  });

  check(res, {
    'join room successful': (r) => r.status === 200,
  });

  return res.status === 200;
}

// 채팅방 나가기 함수
function leaveRoom(token: string, roomId: number): boolean {
  const res = http.post(`${API_BASE_URL}/rooms/${roomId}/leave`, null, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    tags: { type: 'leaveRoom' },
  });

  check(res, {
    'leave room successful': (r) => r.status === 200,
  });

  return res.status === 200;
}

// 사용자 강퇴 함수 (방장만 가능)
function kickUser(token: string, roomId: number, userId: number): boolean {
  const res = http.post(`${API_BASE_URL}/rooms/${roomId}/kick/${userId}`, null, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    tags: { type: 'kickUser' },
  });

  check(res, {
    'kick user successful': (r) => r.status === 200,
  });

  return res.status === 200;
}

// WebSocket 메시지 발송 세션
function sendWebSocketMessages(token: string, roomId: number, messageCount: number = 5): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = `${WS_BASE_URL}?token=${token}`;
    
    const params = {
      headers: {
        'Authorization': `Bearer ${token}`,
      }
    };

    ws.connect(url, params, function(socket) {
      socket.on('open', () => {
        // 방에 참여
        socket.send(JSON.stringify({
          event: 'join_room',
          data: { roomId },
        }));

        // 여러 메시지 전송
        let sentCount = 0;
        const intervalId = setInterval(() => {
          if (sentCount >= messageCount) {
            clearInterval(intervalId);
            socket.close();
            resolve();
            return;
          }

          const messageContent = generateRandomSentence();
          socket.send(JSON.stringify({
            event: 'new_message',
            data: {
              roomId,
              content: messageContent,
            },
          }));

          sentCount++;
        }, 500); // 0.5초마다 메시지 전송
      });

      socket.on('error', (e) => {
        console.error('WebSocket error: ', e);
        reject(e);
      });

      // 5초 후에도 완료되지 않으면 타임아웃으로 처리
      setTimeout(() => {
        socket.close();
        resolve();
      }, 10000);
    });
  });
}

// 실행할 시나리오 함수
export default function() {
  // 시나리오 1: 회원가입 및 로그인
  const newUser = signUp();
  sleep(randomIntBetween(1, 3));
  
  if (newUser) {
    const token = login(newUser);
    console.log('token', token);
    if (!token) return;
    
    // 시나리오 2: 채팅방 생성
    const createdRoom = createRoom(token);
    sleep(randomIntBetween(1, 2));
    
    if (createdRoom) {
      // 시나리오 3: 다른 채팅방 참여 (다른 사람이 만든 방에 가입)
      const otherRoom = randomRoom();
      if (otherRoom && otherRoom.id !== createdRoom.id) {
        joinRoom(token, otherRoom.id);
        sleep(randomIntBetween(1, 2));
        
        // 시나리오 4: WebSocket 메시지 발송
        sendWebSocketMessages(token, otherRoom.id, randomIntBetween(1, 10))
          .catch(e => console.error('Error in WebSocket session:', e));
        sleep(randomIntBetween(2, 5));
        
        // 시나리오 5: 채팅방 나가기
        leaveRoom(token, otherRoom.id);
      }
      
      // 시나리오 6: 내가 만든 방에서 사용자 강퇴 (랜덤한 사용자)
      const randomUserId = randomIntBetween(1, 100);
      kickUser(token, createdRoom.id, randomUserId);
    }
  }

  // 테스트 사이에 짧은 휴식
  sleep(randomIntBetween(1, 3));
} 