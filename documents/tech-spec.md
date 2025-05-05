# 📋 실시간 채팅 시스템 기술 명세서

## 🔹 1. 개발 환경 구성

### Turbo 레포지토리 초기화

````bash
# 1. 프로젝트 폴더 생성
mkdir chat-app && cd chat-app

# 2. pnpm 초기화
pnpm init

# 3. turbo 설치
pnpm add turbo -D

# 4. 모노레포 구조 생성
mkdir -p apps/backend apps/frontend packages/{types,ui,eslint-config,tsconfig}

# 5. turbo.json 생성
cat > turbo.json << EOL
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "lint": {
      "outputs": []
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "clean": {
      "cache": false
    }
  }
}
EOL

# 6. pnpm-workspace.yaml 생성
cat > pnpm-workspace.yaml << EOL
packages:
  - 'apps/*'
  - 'packages/*'
EOL

# 7. 공통 타입 패키지 초기화
cd packages/types
pnpm init
pnpm add -D typescript
cat > tsconfig.json << EOL
{
  "compilerOptions": {
    "target": "es2019",
    "module": "commonjs",
    "declaration": true,
    "outDir": "./dist",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
EOL
cd ../..

# 8. 공통 UI 패키지 초기화
cd packages/ui
pnpm init
pnpm add -D typescript react react-dom
cd ../..

# 9. 공통 ESLint 설정 초기화
cd packages/eslint-config
pnpm init
pnpm add -D eslint
cd ../..

# 10. 공통 TypeScript 설정 초기화
cd packages/tsconfig
pnpm init
mkdir -p base
cat > base/tsconfig.json << EOL
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "display": "Default",
  "compilerOptions": {
    "target": "es2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true
  },
  "exclude": ["node_modules"]
}
EOL
cd ../..

### 루트 패키지 설정

```json
// package.json
{
  "name": "chat-app",
  "version": "0.0.0",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "clean": "turbo run clean",
    "format": "prettier --write \"**/*.{ts,tsx,md}\"",
    "prepare": "husky install"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "prettier": "^3.0.0",
    "husky": "^8.0.0",
    "lint-staged": "^15.0.0"
  },
  "engines": {
    "node": ">=22.0.0",
    "pnpm": ">=8.6.0"
  },
  "packageManager": "pnpm@8.6.0"
}
````

### 백엔드 앱 초기화

```bash
cd apps/backend

# NestJS CLI 설치 및 프로젝트 생성
pnpm add -g @nestjs/cli
nest new . --package-manager pnpm

# 필요한 패키지 설치
pnpm add @nestjs/websockets @nestjs/platform-socket.io @mikro-orm/core @mikro-orm/postgresql @mikro-orm/migrations @nestjs/passport passport-jwt passport bcrypt class-validator class-transformer
pnpm add -D @types/passport-jwt @types/bcrypt
```

### 프론트엔드 앱 초기화

```bash
cd apps/frontend

# React 프로젝트 생성 (Vite 사용)
pnpm create vite . --template react-ts
pnpm install

# 필요한 패키지 설치
pnpm add socket.io-client zustand @tanstack/react-query axios date-fns react-hook-form zod framer-motion tailwindcss phosphor-react
```

### 프로젝트 구조

- 모노레포: TurboRepo 사용
  - apps/
    - backend/ (NestJS)
    - frontend/ (React)
  - packages/
    - types/ (공통 타입 정의)
    - ui/ (공통 UI 컴포넌트)
    - eslint-config/ (공통 ESLint 설정)
    - tsconfig/ (공통 TypeScript 설정)

### 개발 도구

- pnpm v8.6+ (워크스페이스 관리)
- Node.js v22+ (최신 ECMAScript 기능, 향상된 성능 및 패키지 관리)
- TypeScript v5.0+
- Docker + Docker Compose
- Git + GitHub Actions (CI/CD)

### Node.js v22 최적화 설정

```typescript
// apps/backend/.node-version
22.1.0
```

```json
// package.json
{
  "engines": {
    "node": ">=22.0.0",
    "pnpm": ">=8.6.0"
  }
}
```

```typescript
// NestJS main.ts
async function bootstrap() {
  // Node.js v22 성능 최적화
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log"],
    cors: true,
    abortOnError: false,
  });

  // HTTP/3 (QUIC) 지원 설정
  // Node.js v22의 향상된 HTTP 기능 활용
  app.enableShutdownHooks();

  await app.listen(3000);
}
```

```Dockerfile
# apps/backend/Dockerfile
FROM node:22-alpine AS builder

WORKDIR /app
# ... 기존 내용 ...
```

## 🔹 2. 백엔드 기술 명세

### 핵심 라이브러리

| 라이브러리                 | 버전    | 용도                      |
| -------------------------- | ------- | ------------------------- |
| @nestjs/core               | ^10.0.0 | NestJS 핵심 프레임워크    |
| @nestjs/websockets         | ^10.0.0 | WebSocket 게이트웨이 구현 |
| @nestjs/platform-socket.io | ^10.0.0 | Socket.io 통합            |
| @mikro-orm/core            | ^5.7.0  | ORM 코어                  |
| @mikro-orm/postgresql      | ^5.7.0  | PostgreSQL 연동           |
| @mikro-orm/migrations      | ^5.7.0  | DB 마이그레이션           |
| @nestjs/passport           | ^10.0.0 | 인증 미들웨어             |
| passport-jwt               | ^4.0.1  | JWT 인증 전략             |
| passport                   | ^0.6.0  | 인증 라이브러리           |
| bcrypt                     | ^5.1.0  | 비밀번호 해싱             |
| class-validator            | ^0.14.0 | DTO 검증                  |
| class-transformer          | ^0.5.1  | 객체 변환                 |

### DB 엔티티 및 관계 설계

```typescript
// entities/User.ts
@Entity()
@Index({ properties: ["email"] })
export class User {
  @PrimaryKey()
  id: number;

  @Property({ unique: true })
  email: string;

  @Property()
  passwordHash: string;

  @Property()
  nickname: string;

  @Property({ nullable: true })
  imageUrl?: string;

  @OneToMany(() => RoomUser, (ru) => ru.user, {
    eager: false,
    persistence: false,
  })
  roomUsers = new Collection<RoomUser>(this);

  @OneToMany(() => Message, (m) => m.sender, {
    eager: false,
    persistence: false,
  })
  messages = new Collection<Message>(this);
}

// entities/Room.ts
@Entity()
export class Room {
  @PrimaryKey()
  id: number;

  @Property({ nullable: true })
  name?: string;

  @Property()
  isGroup: boolean;

  @OneToMany(() => RoomUser, (ru) => ru.room, {
    eager: false,
    persistence: false,
  })
  users = new Collection<RoomUser>(this);

  @OneToMany(() => Message, (m) => m.room, {
    eager: false,
    persistence: false,
  })
  messages = new Collection<Message>(this);
}

// entities/RoomUser.ts
@Entity()
@Index({ properties: ["user", "room"] })
@Index({ properties: ["room", "lastSeenAt"] })
export class RoomUser {
  @ManyToOne(() => Room, { primary: true, persistence: false })
  room: Room;

  @ManyToOne(() => User, { primary: true, persistence: false })
  user: User;

  @Property()
  joinedAt: Date = new Date();

  @Property({ nullable: true })
  lastSeenAt?: Date;
}

// entities/Message.ts
@Entity()
@Index({ properties: ["room", "insertedAt"] })
@Index({ properties: ["parent"] })
@Index({ properties: ["sender"] })
export class Message {
  @PrimaryKey()
  id: number;

  @ManyToOne(() => Room, { persistence: false })
  room: Room;

  @ManyToOne(() => User, { persistence: false })
  sender: User;

  @ManyToOne(() => Message, { nullable: true, persistence: false })
  parent?: Message;

  @Property()
  content: string;

  @Property()
  insertedAt: Date = new Date();

  @Property({ nullable: true })
  updatedAt?: Date;

  @Property({ nullable: true })
  deletedAt?: Date;

  @OneToMany(() => MessageReaction, (mr) => mr.message, {
    eager: false,
    persistence: false,
  })
  reactions = new Collection<MessageReaction>(this);

  @OneToMany(() => Mention, (m) => m.message, {
    eager: false,
    persistence: false,
  })
  mentions = new Collection<Mention>(this);
}

// entities/MessageReaction.ts
@Entity()
@Index({ properties: ["message", "emoji"] })
@Index({ properties: ["message", "user"] })
export class MessageReaction {
  @PrimaryKey()
  id: number;

  @ManyToOne(() => Message, { persistence: false })
  message: Message;

  @ManyToOne(() => User, { persistence: false })
  user: User;

  @Property()
  emoji: string;
}

// entities/Mention.ts
@Entity()
@Index({ properties: ["mentionedUser"] })
export class Mention {
  @PrimaryKey()
  id: number;

  @ManyToOne(() => Message, { persistence: false })
  message: Message;

  @ManyToOne(() => User, { persistence: false })
  mentionedUser: User;
}
```

### WebSocket 게이트웨이

```typescript
// gateway/chat.gateway.ts
@WebSocketGateway({ cors: true })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly authService: AuthService,
    private readonly messageService: MessageService,
    private readonly roomService: RoomService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.headers.authorization?.split(" ")[1];
      if (!token) {
        client.disconnect();
        return;
      }

      const user = await this.authService.validateToken(token);
      if (!user) {
        client.disconnect();
        return;
      }

      client.data.user = user;
      // 사용자 참여 룸 자동 연결
      const rooms = await this.roomService.getUserRooms(user.id);
      rooms.forEach((room) => {
        client.join(`room:${room.id}`);
      });

      // presence 업데이트
      this.server.emit("user_presence", { userId: user.id, status: "online" });
    } catch (e) {
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    if (client.data.user) {
      this.server.emit("user_presence", {
        userId: client.data.user.id,
        status: "offline",
      });
    }
  }

  @SubscribeMessage("join_room")
  async handleJoinRoom(client: Socket, payload: { roomId: number }) {
    // 권한 확인
    const canJoin = await this.roomService.canUserJoinRoom(
      client.data.user.id,
      payload.roomId,
    );

    if (!canJoin) {
      return { error: "접근 권한이 없습니다" };
    }

    client.join(`room:${payload.roomId}`);
    return { success: true };
  }

  @SubscribeMessage("new_message")
  async handleNewMessage(
    client: Socket,
    payload: {
      roomId: number;
      content: string;
      parentId?: number;
    },
  ) {
    const message = await this.messageService.createMessage({
      roomId: payload.roomId,
      senderId: client.data.user.id,
      content: payload.content,
      parentId: payload.parentId,
    });

    // 메시지 브로드캐스트
    this.server.to(`room:${payload.roomId}`).emit("new_message", message);

    // 멘션 처리
    const mentions = this.messageService.extractMentions(payload.content);
    if (mentions.length > 0) {
      await this.messageService.saveMentions(message.id, mentions);
      for (const userId of mentions) {
        this.server.to(`user:${userId}`).emit("mention_alert", {
          messageId: message.id,
          roomId: payload.roomId,
        });
      }
    }

    return message;
  }

  @SubscribeMessage("edit_message")
  async handleEditMessage(
    client: Socket,
    payload: {
      messageId: number;
      content: string;
    },
  ) {
    const canEdit = await this.messageService.canEditMessage(
      client.data.user.id,
      payload.messageId,
    );

    if (!canEdit) {
      return { error: "메시지를 수정할 권한이 없습니다" };
    }

    const message = await this.messageService.updateMessage(
      payload.messageId,
      payload.content,
    );

    // 룸에 변경사항 브로드캐스트
    this.server.to(`room:${message.room.id}`).emit("message_updated", message);

    return message;
  }

  @SubscribeMessage("react_message")
  async handleReaction(
    client: Socket,
    payload: {
      messageId: number;
      emoji: string;
    },
  ) {
    const reaction = await this.messageService.toggleReaction(
      payload.messageId,
      client.data.user.id,
      payload.emoji,
    );

    const message = await this.messageService.getMessage(payload.messageId);
    this.server.to(`room:${message.room.id}`).emit("reaction_updated", {
      messageId: payload.messageId,
      reactions: await this.messageService.getMessageReactions(
        payload.messageId,
      ),
    });

    return reaction;
  }
}
```

## 🔹 3. 프론트엔드 기술 명세

### 핵심 라이브러리

| 라이브러리            | 버전     | 용도                 |
| --------------------- | -------- | -------------------- |
| react                 | ^18.2.0  | UI 프레임워크        |
| vite                  | ^4.3.0   | 빌드 도구            |
| socket.io-client      | ^4.7.0   | WebSocket 클라이언트 |
| zustand               | ^4.3.0   | 상태 관리            |
| @tanstack/react-query | ^4.29.0  | 서버 상태 관리       |
| axios                 | ^1.4.0   | HTTP 클라이언트      |
| date-fns              | ^2.30.0  | 날짜 처리            |
| react-hook-form       | ^7.45.0  | 폼 관리              |
| zod                   | ^3.21.0  | 스키마 검증          |
| framer-motion         | ^10.12.0 | 애니메이션           |
| tailwindcss           | ^3.3.0   | CSS 프레임워크       |
| phosphor-react        | ^1.4.1   | 아이콘               |

### 상태 관리 - Zustand 설계

```typescript
// store/chatStore.ts
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

interface Message {
  id: number;
  roomId: number;
  senderId: number;
  content: string;
  insertedAt: string;
  updatedAt?: string;
  deletedAt?: string;
  parentId?: number;
}

interface Reaction {
  id: number;
  messageId: number;
  userId: number;
  emoji: string;
}

interface Room {
  id: number;
  name?: string;
  isGroup: boolean;
  users: Array<{
    id: number;
    nickname: string;
    imageUrl?: string;
  }>;
  lastMessage?: Message;
}

interface User {
  id: number;
  nickname: string;
  imageUrl?: string;
  presence: "online" | "offline";
}

interface ChatStore {
  // 상태
  rooms: Room[];
  currentRoomId: number | null;
  messages: Record<number, Message[]>;
  reactions: Record<number, Reaction[]>;
  presence: Record<number, User["presence"]>;

  // 액션
  setRooms: (rooms: Room[]) => void;
  setCurrentRoom: (roomId: number | null) => void;
  addMessage: (roomId: number, message: Message) => void;
  updateMessage: (messageId: number, content: string) => void;
  deleteMessage: (messageId: number) => void;
  setMessages: (roomId: number, messages: Message[]) => void;
  addReaction: (messageId: number, reaction: Reaction) => void;
  removeReaction: (messageId: number, reactionId: number) => void;
  setPresence: (userId: number, status: User["presence"]) => void;
}

export const useChatStore = create<ChatStore>()(
  immer((set) => ({
    rooms: [],
    currentRoomId: null,
    messages: {},
    reactions: {},
    presence: {},

    setRooms: (rooms) =>
      set((state) => {
        state.rooms = rooms;
      }),

    setCurrentRoom: (roomId) =>
      set((state) => {
        state.currentRoomId = roomId;
      }),

    addMessage: (roomId, message) =>
      set((state) => {
        if (!state.messages[roomId]) {
          state.messages[roomId] = [];
        }
        state.messages[roomId].push(message);

        // lastMessage 업데이트
        const roomIndex = state.rooms.findIndex((r) => r.id === roomId);
        if (roomIndex !== -1) {
          state.rooms[roomIndex].lastMessage = message;
        }
      }),

    updateMessage: (messageId, content) =>
      set((state) => {
        for (const roomId in state.messages) {
          const index = state.messages[roomId].findIndex(
            (m) => m.id === messageId,
          );
          if (index !== -1) {
            state.messages[roomId][index].content = content;
            state.messages[roomId][index].updatedAt = new Date().toISOString();
            break;
          }
        }
      }),

    deleteMessage: (messageId) =>
      set((state) => {
        for (const roomId in state.messages) {
          const index = state.messages[roomId].findIndex(
            (m) => m.id === messageId,
          );
          if (index !== -1) {
            state.messages[roomId][index].deletedAt = new Date().toISOString();
            break;
          }
        }
      }),

    setMessages: (roomId, messages) =>
      set((state) => {
        state.messages[roomId] = messages;
      }),

    addReaction: (messageId, reaction) =>
      set((state) => {
        if (!state.reactions[messageId]) {
          state.reactions[messageId] = [];
        }
        state.reactions[messageId].push(reaction);
      }),

    removeReaction: (messageId, reactionId) =>
      set((state) => {
        if (state.reactions[messageId]) {
          state.reactions[messageId] = state.reactions[messageId].filter(
            (r) => r.id !== reactionId,
          );
        }
      }),

    setPresence: (userId, status) =>
      set((state) => {
        state.presence[userId] = status;
      }),
  })),
);
```

### Socket 연결 및 관리 - Socket Hook

```typescript
// hooks/useSocket.ts
import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useAuthStore } from "../store/authStore";
import { useChatStore } from "../store/chatStore";

export const useSocket = () => {
  const socketRef = useRef<Socket | null>(null);
  const token = useAuthStore((state) => state.token);
  const addMessage = useChatStore((state) => state.addMessage);
  const updateMessage = useChatStore((state) => state.updateMessage);
  const deleteMessage = useChatStore((state) => state.deleteMessage);
  const setPresence = useChatStore((state) => state.setPresence);

  useEffect(() => {
    if (!token) return;

    const socket = io(import.meta.env.VITE_API_URL, {
      extraHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("소켓 연결 성공");
    });

    socket.on("disconnect", () => {
      console.log("소켓 연결 종료");
    });

    socket.on("new_message", (message) => {
      addMessage(message.roomId, message);
    });

    socket.on("message_updated", (message) => {
      updateMessage(message.id, message.content);
    });

    socket.on("message_deleted", (messageId) => {
      deleteMessage(messageId);
    });

    socket.on("user_presence", ({ userId, status }) => {
      setPresence(userId, status);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  const joinRoom = (roomId: number) => {
    socketRef.current?.emit("join_room", { roomId });
  };

  const sendMessage = (roomId: number, content: string, parentId?: number) => {
    return new Promise((resolve, reject) => {
      socketRef.current?.emit(
        "new_message",
        { roomId, content, parentId },
        (response: any) => {
          if (response.error) {
            reject(response.error);
          } else {
            resolve(response);
          }
        },
      );
    });
  };

  const editMessage = (messageId: number, content: string) => {
    return new Promise((resolve, reject) => {
      socketRef.current?.emit(
        "edit_message",
        { messageId, content },
        (response: any) => {
          if (response.error) {
            reject(response.error);
          } else {
            resolve(response);
          }
        },
      );
    });
  };

  const reactToMessage = (messageId: number, emoji: string) => {
    socketRef.current?.emit("react_message", { messageId, emoji });
  };

  return {
    socket: socketRef.current,
    joinRoom,
    sendMessage,
    editMessage,
    reactToMessage,
  };
};
```

### 주요 컴포넌트 구조

1. **채팅 레이아웃**

```typescript
// 폴더 구조
// components/
// ├── Layout/
// │   └── ChatLayout.tsx
// ├── Chat/
// │   ├── ChatRoom.tsx
// │   ├── MessageList.tsx
// │   ├── MessageItem.tsx
// │   ├── MessageThread.tsx
// │   ├── MessageInput.tsx
// │   ├── RoomList.tsx
// │   └── RoomItem.tsx
// ├── Common/
// │   ├── Avatar.tsx
// │   ├── Button.tsx
// │   ├── Input.tsx
// │   └── EmojiPicker.tsx
// └── Auth/
//     ├── LoginForm.tsx
//     └── RegisterForm.tsx
```

## 🔹 4. API 명세 상세

### REST API 엔드포인트

| 엔드포인트                  | 메소드 | 설명             | 요청 형식                     | 응답 형식                                          |
| --------------------------- | ------ | ---------------- | ----------------------------- | -------------------------------------------------- |
| /api/auth/signup            | POST   | 회원가입         | { email, password, nickname } | { id, email, nickname, token }                     |
| /api/auth/login             | POST   | 로그인           | { email, password }           | { token, user: { id, email, nickname, imageUrl } } |
| /api/auth/refresh           | POST   | 토큰 갱신        | { refreshToken }              | { token, refreshToken }                            |
| /api/users/me               | GET    | 현재 사용자 정보 | -                             | { id, email, nickname, imageUrl }                  |
| /api/rooms                  | GET    | 참여중인 채팅방  | -                             | [{ id, name, isGroup, users: [...], lastMessage }] |
| /api/rooms                  | POST   | 새 채팅방 생성   | { name?, userIds: [] }        | { id, name, isGroup, users: [...] }                |
| /api/rooms/:id              | GET    | 채팅방 정보      | -                             | { id, name, isGroup, users: [...] }                |
| /api/rooms/:id/messages     | GET    | 메시지 히스토리  | ?limit=20&offset=0            | { items: [...], total: n }                         |
| /api/messages/:id           | PATCH  | 메시지 수정      | { content }                   | { id, content, updatedAt, ... }                    |
| /api/messages/:id           | DELETE | 메시지 삭제      | -                             | { success: true }                                  |
| /api/messages/:id/reactions | POST   | 이모지 반응 토글 | { emoji }                     | { id, emoji, user: {...} }                         |
| /api/messages/:id/threads   | GET    | 스레드 메시지    | -                             | [{ id, content, ... }]                             |
| /api/upload                 | POST   | 이미지 업로드    | FormData { file }             | { url }                                            |

## 🔹 5. 인증 및 권한 관리

### JWT 토큰 구조

```typescript
// 페이로드 구조
interface JwtPayload {
  sub: number; // 사용자 ID
  email: string;
  nickname: string;
  iat: number; // 발급 시간
  exp: number; // 만료 시간
}
```

### 인증 전략 설정

```typescript
// auth/jwt.strategy.ts
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly userService: UserService,
    private readonly configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>("JWT_SECRET"),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.userService.findOneById(payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
```

### DB 인덱싱 전략

```typescript
// entities/User.ts
@Entity()
@Index({ properties: ["email"] })
export class User {
  // ... existing code ...
}

// entities/Room.ts
@Entity()
export class Room {
  // ... existing code ...
}

// entities/RoomUser.ts
@Entity()
@Index({ properties: ["user", "room"] })
@Index({ properties: ["room", "lastSeenAt"] })
export class RoomUser {
  // ... existing code ...
}

// entities/Message.ts
@Entity()
@Index({ properties: ["room", "insertedAt"] })
@Index({ properties: ["parent"] })
@Index({ properties: ["sender"] })
export class Message {
  // ... existing code ...
}

// entities/MessageReaction.ts
@Entity()
@Index({ properties: ["message", "emoji"] })
@Index({ properties: ["message", "user"] })
export class MessageReaction {
  // ... existing code ...
}

// entities/Mention.ts
@Entity()
@Index({ properties: ["mentionedUser"] })
export class Mention {
  // ... existing code ...
}
```

### API 요청에 따른 인덱싱 최적화

| API 엔드포인트              | 관련 인덱스                       | 최적화 효과                            |
| --------------------------- | --------------------------------- | -------------------------------------- |
| /api/auth/login             | User.email                        | 로그인 인증 속도 개선                  |
| /api/rooms                  | RoomUser.user + RoomUser.room     | 사용자 참여 채팅방 목록 조회 속도 개선 |
| /api/rooms/:id/messages     | Message.room + Message.insertedAt | 메시지 히스토리 페이지네이션 속도 개선 |
| /api/messages/:id/reactions | MessageReaction.message           | 메시지별 이모지 반응 조회 속도 개선    |
| /api/messages/:id/threads   | Message.parent                    | 스레드 메시지 조회 속도 개선           |

### 복합 인덱스 전략

특정 조회 패턴에 대해 최적화된 복합 인덱스를 적용하여 성능을 개선합니다:

1. **최근 메시지 조회**: (room_id, inserted_at DESC) 인덱스로 최신 메시지 빠르게 조회
2. **특정 사용자의 대화 검색**: (sender_id, inserted_at) 인덱스로 사용자별 메시지 조회
3. **읽지 않은 메시지 조회**: (room_id, last_seen_at) 인덱스로 안 읽은 메시지 카운트 최적화
4. **멘션 알림 조회**: (mentioned_user_id, inserted_at DESC) 인덱스로 최신 멘션 빠르게 조회

## 🔹 6. 배포 설정

### Docker Compose 설정

```yaml
# docker-compose.yml
version: "3.8"

services:
  db:
    image: postgres:14
    restart: always
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  backend:
    build:
      context: .
      dockerfile: ./apps/backend/Dockerfile
    image: chat-backend:latest
    restart: always
    depends_on:
      - db
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@db:5432/${DB_NAME}
      - JWT_SECRET=${JWT_SECRET}
      - PORT=3000
      - NODE_OPTIONS="--no-warnings --max-old-space-size=4096"
    ports:
      - "3000:3000"
    deploy:
      resources:
        limits:
          cpus: "1"
          memory: 2G

  frontend:
    build:
      context: .
      dockerfile: ./apps/frontend/Dockerfile
    image: chat-frontend:latest
    restart: always
    depends_on:
      - backend
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf
      - ./certs:/etc/nginx/certs

volumes:
  postgres_data:
```

### Dockerfile 설정

```Dockerfile
# apps/backend/Dockerfile
FROM node:22-alpine AS builder

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/types/package.json ./packages/types/

RUN corepack enable pnpm && \
    pnpm install --frozen-lockfile

COPY . .
RUN pnpm build --filter=backend

FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV production

COPY --from=builder /app/apps/backend/dist ./dist
COPY --from=builder /app/apps/backend/package.json ./
COPY --from=builder /app/node_modules ./node_modules

# Node.js v22 최적화 설정
ENV NODE_OPTIONS="--no-warnings --max-old-space-size=4096"

CMD ["node", "dist/main.js"]
```

```Dockerfile
# apps/frontend/Dockerfile
FROM node:22-alpine AS builder

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/frontend/package.json ./apps/frontend/
COPY packages/ui/package.json ./packages/ui/
COPY packages/types/package.json ./packages/types/

RUN corepack enable pnpm && \
    pnpm install --frozen-lockfile

COPY . .
RUN pnpm build --filter=frontend

FROM nginx:alpine

COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html
COPY ./nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
EXPOSE 443

CMD ["nginx", "-g", "daemon off;"]
```

### NGINX HTTP/3 설정

```nginx
# nginx.conf
server {
    listen 80;
    listen [::]:80;
    server_name example.com;

    # HTTP -> HTTPS 리다이렉트
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    # HTTP/3 지원
    listen 443 quic;
    listen [::]:443 quic;

    server_name example.com;

    # 인증서 설정
    ssl_certificate /etc/nginx/certs/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/privkey.pem;

    # HTTP/3 관련 설정
    add_header Alt-Svc 'h3=":443"; ma=86400';

    # 보안 관련 설정
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers 'ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305';

    # 정적 파일 서빙
    location / {
        root /usr/share/nginx/html;
        index index.html index.htm;
        try_files $uri $uri/ /index.html;
    }

    # API 요청 프록시
    location /api {
        proxy_pass http://backend:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # 소켓 연결 프록시
    location /socket.io {
        proxy_pass http://backend:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 🔹 7. 테스트 전략

### 백엔드 테스트

- 단위 테스트: Jest
- 통합 테스트: NestJS Testing
- E2E 테스트: Supertest
- WebSocket 테스트: Socket.io-client

### 프론트엔드 테스트

- 단위 테스트: Vitest
- 컴포넌트 테스트: React Testing Library
- E2E 테스트: Cypress

### 테스트 자동화

- GitHub Actions 기반 CI 파이프라인
- 매 PR 시 테스트 수행
- 배포 전 통합 테스트 검증

## 🔹 8. 모니터링 및 로깅

### 로깅 설정

- Winston 로거 설정
- Sentry 에러 트래킹 연동
- 운영 환경 로그 레벨: info (개발: debug)

### 성능 모니터링

- Prometheus 기반 측정 지표 수집
- Grafana 대시보드 구성

### 측정 지표

- API 응답 시간
- 웹소켓 연결 수
- 메시지 처리 성능
- 데이터베이스 성능

## 🔹 9. 확장성 및 성능 개선

### 확장 전략

- 마이크로서비스 아키텍처 고려
- 메시지 큐 도입 (Redis PubSub)
- 분산 캐싱 (Redis)

### 성능 최적화

- DB 인덱싱 전략
- 쿼리 최적화
- 메시지 페이지네이션
- 웹소켓 연결 관리 최적화

## 🔹 10. 구현 우선순위 및 로드맵

### 1단계 (MVP)

- 기본 인증 시스템
- 1:1 채팅 기능
- 실시간 메시지 전송
- 메시지 히스토리 조회

### 2단계

- 그룹 채팅
- 이모지 반응
- 스레드 기능
- 멘션 및 알림

### 3단계

- 이미지 업로드
- HTTP/3 최적화
- 모바일 최적화 UI
- 푸시 알림

### MikroORM 설정

```typescript
// mikro-orm.config.ts
import { Options } from "@mikro-orm/core";
import { PostgreSqlDriver } from "@mikro-orm/postgresql";

const config: Options<PostgreSqlDriver> = {
  driver: PostgreSqlDriver,
  dbName: process.env.DB_NAME,
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || "5432"),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  entities: ["dist/**/*.entity.js"],
  entitiesTs: ["src/**/*.entity.ts"],
  debug: process.env.NODE_ENV !== "production",
  migrations: {
    tableName: "mikro_migrations",
    path: "dist/migrations",
    pathTs: "src/migrations",
  },
  // 외래키 제약 조건 끄기
  schemaGenerator: {
    disableForeignKeys: true,
    createForeignKeyConstraints: false,
  },
  persistOnCreate: false, // 엔티티 생성 시 자동 저장 방지
};

export default config;
```

### DB 인덱싱 전략
