# 채팅 애플리케이션

최신 기술로 구축된 실시간 채팅 애플리케이션입니다.

## 프로젝트 구조

이 프로젝트는 Turborepo와 pnpm으로 관리되는 모노레포입니다. 구조는 다음과 같습니다:

- `apps/`
  - `backend/` - NestJS 백엔드 애플리케이션
  - `frontend/` - React 프론트엔드 애플리케이션
- `packages/`
  - `types/` - 공유 TypeScript 타입
  - `eslint-config/` - 공유 ESLint 설정
  - `tsconfig/` - 공유 TypeScript 설정

## 개발 환경 설정

1. **필수 조건**
   - Node.js v22+
   - pnpm v8.6+

2. **설치**
   ```bash
   pnpm install
   ```

3. **개발**
   ```bash
   pnpm dev
   ```

4. **빌드**
   ```bash
   pnpm build
   ```

## 기술 스택

- **백엔드**: NestJS, WebSockets, MikroORM, PostgreSQL
- **프론트엔드**: React, Socket.io-client, Zustand, TanStack Query
- **공통**: TypeScript, ESLint, Prettier

## 라이센스

ISC 