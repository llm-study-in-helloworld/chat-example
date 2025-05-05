# 📍 실시간 채팅 시스템 PRD (NestJS + React + MikroORM + HTTP/3)

---

## 🔹 1. 개요

### 목적

- 사용자 간 실시간 메시지 전송과 수신이 가능한 웹 기반 채팅 플랫폼 구축
- HTTP/3 기반 통신으로 빠른 응답성과 안정성 확보
- 사용자 인증, 메시지 기록, 실시간 알림, 스레드형 대화 및 이모지 반응 기능 제공

### 주요 기술 스택

| 영역       | 기술                                               |
| ---------- | -------------------------------------------------- |
| 백엔드     | NestJS (WebSocket Gateway, Passport JWT), MikroORM |
| 프론트엔드 | React (Vite/Next.js), Zustand, TanStack Query      |
| DB         | PostgreSQL                                         |
| 통신       | HTTP/3 (QUIC 기반)                                 |
| 배포       | Docker + Fly.io, TurboRepo 기반 Monorepo 구조      |
| 인증       | JWT 기반 인증 (Passport)                           |
| 암호화     | Bcrypt (비밀번호), TLS (wss)                       |

---

## 🔧 2. 기능 명세

### 2.1 사용자 관리

| 기능              | 설명                                  |
| ----------------- | ------------------------------------- |
| 회원가입 / 로그인 | JWT 발급 / 갱신                       |
| 프로필            | 닉네임, 프로필 이미지                 |
| 인증              | Passport JWT + Bcrypt 암호화          |
| 오류 검증         | 403 / 401 처리, socket 연결 예외 처리 |

### 2.2 채팅 기능

| 기능             | 설명                                            |
| ---------------- | ----------------------------------------------- |
| 채팅방 입장      | WebSocket Gateway 구성 (room:{id})              |
| 메시지 전송/수신 | "new_message" event 전송 / broadcast            |
| 메시지 스레드    | 메시지에 대해 하위 스레드(답글) 작성 기능       |
| 메시지 이모지    | 메시지에 이모지 반응 추가 기능 (예: ❤️, 😂, 👀) |
| 히스토리 로딩    | REST API + pagination                           |
| 읽음 처리        | seen_at[] 저장                                  |
| 이미지 전송      | AWS S3 연계 또는 Base64 변환                    |
| 메시지 수정/삭제 | 권한 검사 + 실시간 sync                         |
| 멘션 기능        | @nickname 형식 파싱 + 알림 트리거               |

### 2.3 채팅방 관리

| 기능          | 설명                            |
| ------------- | ------------------------------- |
| 1:1 채팅      | 두 사용자 간 고유 room 생성     |
| 그룹 채팅     | 다수 사용자 초대 가능           |
| 채팅방 나가기 | 마지막 seen_at 확인 + 연결 종료 |

### 2.4 실시간 알림

| 기능        | 설명                                             |
| ----------- | ------------------------------------------------ |
| 메시지 알림 | 메시지 수신 및 멘션 시 알림 발생                 |
| Presence    | 사용자 접속 상태 표시 (WebSocket + Redis PubSub) |
| 알림 설정   | 알림 on/off 기능 제공                            |

---

## 💻 3. 프론트엔드 구조

- React
- Zustand: global state 관리 (room list, message list, presence 등)
- TanStack Query: REST API 캐싱 및 서버 상태 관리
- socket.io-client 기반 WebSocket 통신 (NestJS Gateway와 연결)
- TurboRepo 기반 Monorepo 구성 (apps, packages 폴더로 클라이언트/서버/공통 모듈 분리)

```ts
// Zustand 상태 예시
const useChatStore = create((set) => ({
  rooms: [],
  messages: {},
  reactions: {},
  threads: {},
  presence: {},
  addMessage: (roomId, msg) =>
    set((state) => {
      state.messages[roomId] = [...(state.messages[roomId] || []), msg];
    }),
}));
```

---

## 🛠️ 4. 백엔드 (NestJS Gateway + MikroORM + Auth)

- MikroORM 기반 DB 모델 정의 및 쿼리 수행
- Passport JWT 인증 적용 (REST 및 WebSocket handshake 포함)
- WebSocket Gateway 구성:
  - handleConnection / Disconnect
  - handleMessage / Edit / Delete / Reaction / Thread

---

## 📂 5. DB 스키마 (PostgreSQL, MikroORM)

### ERD

```
users (id, email, password_hash, nickname, image_url)
rooms (id, name, is_group)
room_users (room_id, user_id, joined_at)
messages (id, room_id, sender_id, parent_id, content, inserted_at, updated_at, deleted_at)
message_reactions (id, message_id, user_id, emoji)
mentions (id, message_id, mentioned_user_id)
```

---

## 💡 6. API 스펙

| Method | URL                         | 설명                     |
| ------ | --------------------------- | ------------------------ |
| POST   | /api/auth/signup            | 회원가입                 |
| POST   | /api/auth/login             | 로그인 (JWT 발급)        |
| GET    | /api/rooms                  | 참여중인 채팅방 목록     |
| GET    | /api/rooms/:id/messages     | 메시지 히스토리 불러오기 |
| PATCH  | /api/messages/:id           | 메시지 수정              |
| DELETE | /api/messages/:id           | 메시지 삭제              |
| POST   | /api/messages/:id/reactions | 메시지에 이모지 추가     |
| POST   | /api/messages/:id/threads   | 스레드 메시지 작성       |
| POST   | /api/upload                 | 이미지 업로드            |

---

## 🔄 7. Gateway 이벤트 흐름

| 이벤트         | 방향             | 설명                      |
| -------------- | ---------------- | ------------------------- |
| join_room      | client -> server | 방 입장 요청              |
| new_message    | client -> server | 새 메시지 전송            |
| new_message    | server -> client | 메시지 브로드캐스트       |
| edit_message   | client -> server | 메시지 수정 요청          |
| delete_message | client -> server | 메시지 삭제 요청          |
| thread_message | client -> server | 스레드 메시지 전송        |
| react_message  | client -> server | 메시지에 이모지 반응 추가 |
| mention_alert  | server -> client | 멘션된 유저에게 알림      |

---

## 🚀 8. 배포

- Docker 기반 멀티 컨테이너 구성
  - apps/backend (NestJS)
  - apps/frontend (React)
  - db (PostgreSQL)
- TurboRepo 모노레포 구조 사용 (apps/, packages/ 구분)
- HTTP/3 통신을 위한 NGINX 설정 포함
- TLS 및 QUIC 활성화
- 배포 대상: Fly.io, AWS ECS, Render 등
- Static 파일은 S3 또는 CDN 제공

---

## ✨ 9. 확장 기능

- 챗봇 연동: GPT API / 사내 FAQ Bot 등으로 확장 가능
- 브라우저/모바일 푸시 알림
- WebRTC 기반 비디오 / 음성 채팅
- 모바일 앱 (Flutter / React Native 기반)

---

## 📊 10. 테스트

| 항목        | 도구                                 |
| ----------- | ------------------------------------ |
| 유닛 테스트 | Jest (NestJS), React Testing Library |
| 통합 테스트 | WebSocket Gateway e2e 테스트         |
| 부하 테스트 | k6, Artillery.io                     |
| 보안 테스트 | 인증 우회, WebSocket 인증 헤더 검증  |
