# 채팅 애플리케이션 Makefile

# 기본 설정
.PHONY: help init setup gen-certs setup-env db-migrate dev start stop k6-start k6-stop k6-test

# 도움말
help:
	@echo "채팅 애플리케이션 Makefile"
	@echo ""
	@echo "개발 환경 설정:"
	@echo "  make init                  - 개발 환경 전체 초기화 (인증서 생성 + 환경 변수 설정 + DB 마이그레이션)"
	@echo "  make gen-certs             - 개발용 SSL 인증서 생성"
	@echo "  make setup-env             - 백엔드 환경 변수 설정 (.env-example → .env)"
	@echo "  make db-migrate            - 데이터베이스 마이그레이션 실행"
	@echo ""
	@echo "도커 명령어:"
	@echo "  make dev                   - 개발 환경 실행 (docker-compose up -d)"
	@echo "  make start                 - 개발 환경 실행 (docker-compose up -d)"
	@echo "  make stop                  - 개발 환경 중지 (docker-compose down)"
	@echo ""
	@echo "부하 테스트:"
	@echo "  make k6-start             - k6 테스트 인프라 시작 (InfluxDB, Grafana)"
	@echo "  make k6-stop              - k6 테스트 인프라 중지"
	@echo "  make k6-test TYPE=<test>  - 특정 k6 테스트 실행"
	@echo "    가능한 테스트 유형: minimal, websocket, realistic, load, full, ws-stress, ws-flood, ws-reconnect, high-load, all"
	@echo "    예: make k6-test TYPE=websocket"
	@echo ""
	@echo "기타:"
	@echo "  make help                  - 도움말 표시"

# 개발 환경 초기화 (전체)
init: gen-certs setup-env db-migrate
	@echo "개발 환경이 초기화되었습니다."

# SSL 인증서 생성
gen-certs:
	@echo "개발용 SSL 인증서 생성 중..."
	@bash ./gen-certs.sh

# 환경 변수 설정
setup-env:
	@echo "백엔드 환경 변수 설정 중..."
	@if [ ! -f ./apps/backend/.env ]; then \
		cp ./apps/backend/.env-example ./apps/backend/.env; \
		echo "백엔드 .env 파일이 생성되었습니다. 필요에 따라 편집하세요."; \
	else \
		echo "백엔드 .env 파일이 이미 존재합니다. 덮어쓰지 않았습니다."; \
	fi

# 데이터베이스 마이그레이션 실행
db-migrate:
	@echo "데이터베이스 마이그레이션을 실행합니다..."
	@echo "백엔드 컨테이너를 시작합니다..."
	@docker-compose up -d mysql
	@echo "MySQL이 완전히 시작될 때까지 10초 대기..."
	@sleep 10
	@echo "백엔드 컨테이너를 임시로 시작하여 마이그레이션을 실행합니다..."
	@docker-compose run --rm backend sh -c "cd /app/apps/backend && pnpm migration:up"
	@echo "데이터베이스 마이그레이션이 완료되었습니다."

# 도커 명령어
dev: start

start:
	@echo "개발 환경 시작 중..."
	@docker-compose up -d
	@echo "개발 환경이 시작되었습니다."
	@echo "백엔드: https://localhost:5002 (API)"
	@echo "프론트엔드: http://localhost:5173 (직접 접속)"
	@echo "WebSocket: wss://localhost:5002 (Nginx 프록시)"
	@echo "MySQL: localhost:12321 (사용자: root, 비밀번호: password)"

stop:
	@echo "개발 환경 중지 중..."
	@docker-compose down
	@echo "개발 환경이 중지되었습니다."

# k6 테스트 명령어
k6-start:
	@echo "k6 테스트 인프라 시작 중..."
	@cd k6-tests && make start-infra
	@echo "Grafana 대시보드: http://localhost:3001"

k6-stop:
	@echo "k6 테스트 인프라 중지 중..."
	@cd k6-tests && make stop-infra

k6-test:
	@if [ -z "$(TYPE)" ]; then \
		echo "테스트 유형을 지정해야 합니다. 예: make k6-test TYPE=websocket"; \
		exit 1; \
	fi
	@echo "k6 테스트 실행 중: $(TYPE)"
	@case "$(TYPE)" in \
		minimal) cd k6-tests && make test-minimal ;; \
		websocket) cd k6-tests && make test-websocket ;; \
		realistic) cd k6-tests && make test-realistic ;; \
		load) cd k6-tests && make test-load ;; \
		full) cd k6-tests && make test-full ;; \
		ws-stress) cd k6-tests && make test-ws-stress ;; \
		ws-flood) cd k6-tests && make test-ws-flood ;; \
		ws-reconnect) cd k6-tests && make test-ws-reconnect ;; \
		high-load) cd k6-tests && make test-high-load ;; \
		all) cd k6-tests && make all ;; \
		*) echo "알 수 없는 테스트 유형: $(TYPE)" && exit 1 ;; \
	esac 