# K6 부하 테스트

이 디렉토리에는 채팅 애플리케이션에 대한 k6 부하 테스트 스크립트와 설정이 포함되어 있습니다.

## 새로운 개선사항

- **통합 Docker Compose 설정**: 표준 테스트와 고부하 테스트에 모두 사용 가능
- **Makefile 도입**: 모든 테스트 실행을 위한 간단한 명령어 제공
- **개선된 로그 관리**: 각 테스트 유형별로 구성된 로그 폴더 구조
- **WebSocket 최적화**: Socket.IO 프로토콜을 위한 최적화된 테스트

## 시작하기

### 1. 설정

처음 시작할 때는 다음 명령어로 필요한 환경을 설정하세요:

```bash
cd k6-tests
make setup
```

이 명령어는 필요한 패키지를 설치하고 TypeScript 코드를 빌드합니다.

### 2. 인프라 시작

테스트를 실행하기 전에 InfluxDB와 Grafana를 시작합니다:

```bash
make start-infra
```

Grafana 대시보드는 http://localhost:3001 에서 확인할 수 있습니다.

### 3. 테스트 실행

다양한, 테스트 유형 중에서 선택할 수 있습니다:

#### 기본 테스트

```bash
make test-minimal      # 최소 테스트
make test-websocket    # 기본 WebSocket 테스트
make test-realistic    # 현실적인 사용 패턴 테스트
make test-load         # 부하 테스트
make test-full         # 전체 워크플로우 테스트
```

#### WebSocket 전문 테스트

```bash
make test-ws-stress    # WebSocket 스트레스 테스트 (최대 200명 동시 사용자)
make test-ws-flood     # WebSocket 메시지 폭주 테스트 (메시지 처리량 테스트)
make test-ws-reconnect # WebSocket 재연결 테스트 (연결 안정성 테스트)
```

#### 고부하 테스트

```bash
make test-high-load    # 고부하 WebSocket 테스트 (대량 메시지)
```

#### 모든 테스트 실행

모든 테스트를 순차적으로 실행하려면:

```bash
make all
```

### 4. 테스트 구성

테스트 대상 서버를 지정하려면 환경 변수를 사용합니다:

```bash
SERVER_HOST=nginx SERVER_PORT=5002 make test-websocket
```

### 5. 인프라 중지

테스트 완료 후 인프라를 중지합니다:

```bash
make stop-infra
```

## 로그 관리

모든 테스트 로그는 다음 구조로 저장됩니다:

```
results/
├── minimal-test/
│   ├── 20240505_123456.log   # 최근 실행 로그
│   ├── 20240505_123123.log   # 이전 실행 로그
│   └── backups/              # 백업 로그
├── websocket-test/
│   ├── ...
├── websocket-message-flood-test/
│   ├── ...
└── ...
```

이전 로그 파일을 새 구조로 마이그레이션하려면:

```bash
make migrate-logs
```

## 도커 설정

이 테스트 시스템은 두 개의 프로필로 구성된 단일 Docker Compose 파일을 사용합니다:

1. **standard**: 일반 테스트용 표준 k6 구성
2. **high-load**: 고부하 테스트에 최적화된 k6 구성

## 도움말

모든 사용 가능한 명령어 목록을 보려면:

```bash
make help
``` 