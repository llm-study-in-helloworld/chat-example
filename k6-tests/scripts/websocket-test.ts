import { randomIntBetween, randomItem, randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';
import { check, sleep } from 'k6';
import http from 'k6/http';
import { Trend } from 'k6/metrics';
import ws, { WebSocketError } from 'k6/ws';
import { AuthResponse } from '../../packages/types/dist';

// Define types
interface UserCredentials {
  token: string;
  userId: string;
}

interface Room {
  id: string;
  name: string;
  isPrivate: boolean;
  isDirect: boolean;
  [key: string]: any;
}

interface Message {
  event: string;
  data: {
    roomId?: string;
    content?: string;
    [key: string]: any;
  };
}

// Get environment variables
const API_HOST: string = __ENV.API_HOST || 'localhost';
const API_PORT: string = __ENV.API_PORT || '3000';

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

// 커스텀 메트릭 정의
const wsMessagesSent = new Trend('websocket_messages_sent');
const wsMessagesReceived = new Trend('websocket_messages_received');
const wsConnectTime = new Trend('websocket_connect_time');
const wsConnectionErrors = new Trend('websocket_connection_errors');

// 테스트 설정
export const options = {
  stages: [
    { duration: '10s', target: 50 },    // 50명으로 증가
    { duration: '30s', target: 100 },   // 100명으로 천천히 증가
    { duration: '1m', target: 500 },    // 500명으로 증가
    { duration: '2m', target: 1000 },   // 1,000명으로 증가
    { duration: '1m', target: 2000 },   // 2,000명으로 급격히 증가
    { duration: '1m', target: 3000 },   // 3,000명으로 증가
    { duration: '30s', target: 0 },     // 종료
  ],
  thresholds: {
    'websocket_messages_sent': ['avg < 500'],
    'websocket_messages_received': ['avg < 500'],
    'websocket_connect_time': ['p(95) < 1000'],
    'websocket_connection_errors': ['count < 100'],
  },
  insecureSkipTLSVerify: true, // Skip TLS certificate validation
};

// API 기본 URL
const API_BASE_URL = `http://${API_HOST}:${API_PORT}/api`;
const WS_BASE_URL = `ws://${API_HOST}:${API_PORT}`;

// 계정 생성 및 로그인
function setupUser(): UserCredentials | null {
  // 회원가입
  const email = generateRandomEmail();
  const nickname = generateRandomNickname();
  const password = 'Password123!';

  const registerPayload = JSON.stringify({
    email,
    nickname,
    password,
  });

  const registerRes = http.post(`${API_BASE_URL}/auth/signup`, registerPayload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(registerRes, {
    'registered successfully': (r) => r.status === 201,
  });

  // 로그인
  const loginPayload = JSON.stringify({
    email,
    password,
  });

  const loginRes = http.post(`${API_BASE_URL}/auth/login`, loginPayload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(loginRes, {
    'logged in successfully': (r) => r.status === 200,
  });

  if (loginRes.status !== 200) {
    console.error(`Login failed: ${loginRes.status} ${loginRes.body}`);
    return null;
  }

  const loginData = (loginRes.json()) as unknown as AuthResponse;
  return {
    token: loginData.token,
    userId: loginData.user.id.toString(),
  };
}

// 방 생성
function createRoom(token: string): Room | null {
  const roomName = `Room-${randomString(8)}`;
  
  const payload = JSON.stringify({
    name: roomName,
    isPrivate: false,
    isDirect: false,
    userIds: [],
  });

  const res = http.post(`${API_BASE_URL}/rooms`, payload, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });

  check(res, {
    'room created successfully': (r) => r.status === 201,
  });

  if (res.status !== 201) {
    console.error(`Create room failed: ${res.status} ${res.body}`);
    return null;
  }

  return res.json() as unknown as Room;
}

// WebSocket 메시지 처리 세션
function runWebSocketSession(userToken: string, roomId: string): void {
  const url = `${WS_BASE_URL}?token=${userToken}`;
  
  const connectStart = new Date().getTime();
  const res = ws.connect(url, {}, function(socket) {
    // 연결 시간 측정
    const connectEnd = new Date().getTime();
    wsConnectTime.add(connectEnd - connectStart);

    socket.on('open', () => {
      console.log('WebSocket 연결 성공');
      
      // 방 참여
      socket.send(JSON.stringify({
        event: 'join_room',
        data: { roomId },
      }));

      // 메시지 전송 (랜덤한 횟수)
      const messageCount = randomIntBetween(5, 15);
      let sentCount = 0;
      
      const sendInterval = setInterval(() => {
        if (sentCount >= messageCount) {
          clearInterval(sendInterval);
          return;
        }

        const messageText = generateRandomSentence();
        const startTime = new Date().getTime();
        
        socket.send(JSON.stringify({
          event: 'new_message',
          data: {
            roomId,
            content: messageText,
          },
        }));
        
        wsMessagesSent.add(new Date().getTime() - startTime);
        sentCount++;
      }, 1000); // 1초마다 메시지 전송
      
      // 메시지 수신 처리
      socket.on('message', (msg: string) => {
        const receiveTime = new Date().getTime();
        wsMessagesReceived.add(receiveTime - connectEnd);
        
        try {
          const data = JSON.parse(msg);
          // 필요하면 여기서 추가 로직 구현
        } catch (e) {
          console.error('Invalid message format', e);
        }
      });

      // 최대 20초 후 연결 종료
      setTimeout(() => {
        socket.close();
      }, 20000);
    });

    // 에러 처리
    socket.on('error', (e: WebSocketError) => {
      console.error('WebSocket error: ', e);
      wsConnectionErrors.add(1);
    });

    // 연결 종료
    socket.on('close', () => {
      console.log('WebSocket 연결 종료');
    });
  });

  // 연결 실패 체크
  check(res, {
    'WebSocket 연결 성공': (r) => r && r.status === 101,
  });
  
  if (res.status !== 101) {
    wsConnectionErrors.add(1);
  }
}

// 메인 테스트 함수
export default function() {
  // 1. 사용자 설정 (회원가입 & 로그인)
  const user = setupUser();
  if (!user) return;
  
  sleep(1);
  
  // 2. 채팅방 생성
  const room = createRoom(user.token);
  if (!room) return;
  
  sleep(1);
  
  // 3. WebSocket 세션 실행
  runWebSocketSession(user.token, room.id);
  
  // 마지막 메시지가 처리될 시간을 주기 위해 대기
  sleep(randomIntBetween(10, 20));
} 