# 채팅 애플리케이션

최신 기술로 구축된 실시간 채팅 애플리케이션입니다.

## 프로젝트 구조

이 프로젝트는 Turborepo와 pnpm으로 관리되는 모노레포입니다. 주요 구조는 다음과 같습니다:

- `apps/`
  - `backend/` - NestJS 기반의 실시간 채팅 백엔드
  - `frontend/` - React 기반의 프론트엔드
- `packages/`
  - `types/` - 프론트엔드/백엔드에서 공통으로 사용하는 TypeScript 타입
  - `eslint-config/` - 프로젝트 전반에 적용되는 ESLint 설정
  - `tsconfig/` - 공통 TypeScript 설정
- `documents/`
  - `tech-spec.md`, `prd.md` - 기술 명세 및 기획 문서
- `k6-tests/` - k6 기반 부하 테스트 스크립트 및 결과, 부하테스트 관련 문서
- `grafana/` - Grafana 대시보드 및 데이터소스 설정 (모니터링/시각화)
- `nginx/` - Nginx 리버스 프록시 및 개발/운영 환경용 설정
- `certs/` - 로컬 HTTPS 개발을 위한 인증서 저장 디렉토리
- `.husky/` - Git hooks (커밋, 푸시 등 자동화 스크립트)

## 개발 환경 설정

### Makefile을 이용한 간편 설정

프로젝트에서는 개발 환경 설정과 실행을 위한 Makefile을 제공합니다:

```bash
# 도움말 보기
make help

# 개발 환경 초기화 (인증서 생성 + 환경변수 설정 + DB 마이그레이션)
make init

# 개발용 SSL 인증서만 생성
make gen-certs

# 백엔드 환경 변수 설정
make setup-env

# 데이터베이스 마이그레이션 실행
make db-migrate
```

### Docker로 실행하기

```bash
# 개발 환경 시작
make dev
# 또는
make start

# 개발 환경 중지
make stop
```

시작 후 접속 가능한 주소:

- 백엔드 API: https://localhost:5002
- 프론트엔드: http://localhost:5173
- WebSocket: wss://localhost:5002
- MySQL: localhost:12321 (사용자: root, 비밀번호: password)

### k6 부하 테스트 실행

```bash
# k6 테스트 인프라 시작 (InfluxDB, Grafana)
make k6-start

# k6 테스트 실행 (TYPE 파라미터 필수)
make k6-test TYPE=websocket
# 가능한 테스트 유형: minimal, websocket, realistic, load, full,
#                   ws-stress, ws-flood, ws-reconnect, high-load, all

# k6 테스트 인프라 중지
make k6-stop
```

## 기술 스택

- **백엔드**: NestJS, WebSockets, MikroORM, ~PostgreSQL~ MySQL
- **프론트엔드**: React, Socket.io-client, Zustand, TanStack Query
- **공통**: TypeScript, ESLint, Prettier
- **테스트/모니터링**: k6, Grafana, Nginx, self-signed certs (로컬 HTTPS)

## 라이센스

ISC
