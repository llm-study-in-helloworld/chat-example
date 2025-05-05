# K6 부하 테스트 Makefile

# 기본 설정
.PHONY: help setup clean start-infra stop-infra migrate-logs \
        test-minimal test-websocket test-realistic test-load test-full \
        test-ws-stress test-ws-flood test-ws-reconnect \
        test-high-load all

DOCKER_COMPOSE = docker compose -f docker/docker-compose.yml
SERVER_HOST ?= nginx
SERVER_PORT ?= 5002

# 도움말
help:
	@echo "K6 부하 테스트 Makefile"
	@echo ""
	@echo "기본 명령어:"
	@echo "  make setup                 - 필요한 폴더 구조 생성 및 빌드"
	@echo "  make clean                 - 임시 파일 정리"
	@echo "  make start-infra           - InfluxDB 및 Grafana 시작"
	@echo "  make stop-infra            - InfluxDB 및 Grafana 중지"
	@echo "  make migrate-logs          - 기존 로그 파일 새 구조로 마이그레이션"
	@echo ""
	@echo "기본 테스트:"
	@echo "  make test-minimal          - 최소 테스트 실행"
	@echo "  make test-websocket        - 기본 WebSocket 테스트 실행"
	@echo "  make test-realistic        - 현실적인 사용 패턴 테스트 실행"
	@echo "  make test-load             - 부하 테스트 실행"
	@echo "  make test-full             - 전체 워크플로우 테스트 실행"
	@echo ""
	@echo "WebSocket 전문 테스트:"
	@echo "  make test-ws-stress        - WebSocket 스트레스 테스트 실행"
	@echo "  make test-ws-flood         - WebSocket 메시지 폭주 테스트 실행"
	@echo "  make test-ws-reconnect     - WebSocket 재연결 테스트 실행"
	@echo ""
	@echo "고부하 테스트:"
	@echo "  make test-high-load        - 고부하 WebSocket 테스트 실행"
	@echo ""
	@echo "모든 테스트:"
	@echo "  make all                   - 모든 테스트 순차적으로 실행"
	@echo ""
	@echo "환경 변수:"
	@echo "  SERVER_HOST=nginx          - 서버 호스트 설정 (기본값: nginx)"
	@echo "  SERVER_PORT=5002           - 서버 포트 설정 (기본값: 5002)"

# 기본 설정 및 폴더 구조 생성
setup:
	@echo "필요한 폴더 구조 생성..."
	@mkdir -p results
	@pnpm install
	@pnpm run build

# 정리
clean:
	@echo "임시 파일 정리..."
	@rm -rf node_modules/.cache
	@rm -rf .parcel-cache

# InfluxDB 및 Grafana 시작
start-infra:
	@echo "InfluxDB 및 Grafana 시작..."
	@$(DOCKER_COMPOSE) --profile standard up -d influxdb grafana
	@echo "Grafana는 http://localhost:3001 에서 사용 가능합니다."

# InfluxDB 및 Grafana 중지
stop-infra:
	@echo "InfluxDB 및 Grafana 중지..."
	@$(DOCKER_COMPOSE) down

# 로그 마이그레이션
migrate-logs:
	@echo "로그 파일 마이그레이션..."
	@./scripts/migrate-logs.sh

# 일반 테스트 실행 함수
define run_test
	@echo "$(1) 테스트 실행..."
	@mkdir -p results/$(2)
	@pnpm run build
	@$(DOCKER_COMPOSE) --profile standard run \
		-e TEST_SCRIPT=./$(2).js \
		-e API_HOST=$(SERVER_HOST) \
		-e API_PORT=$(SERVER_PORT) \
		--rm k6 run /dist/$(2).js | tee results/$(2)/$$(date +%Y%m%d_%H%M%S).log
endef

# 고부하 테스트 실행 함수
define run_high_load_test
	@echo "고부하 $(1) 테스트 실행..."
	@mkdir -p results/$(2)
	@NODE_OPTIONS="--max-old-space-size=8192" pnpm run build
	@$(DOCKER_COMPOSE) --profile high-load run \
		-e TEST_SCRIPT=./$(2).js \
		-e API_HOST=$(SERVER_HOST) \
		-e API_PORT=$(SERVER_PORT) \
		--rm k6-high-load run /dist/$(2).js | tee results/$(2)/$$(date +%Y%m%d_%H%M%S).log
endef

# 기본 테스트
test-minimal:
	$(call run_test,최소,minimal-test)

test-websocket:
	$(call run_test,WebSocket,websocket-test)

test-realistic:
	$(call run_test,현실적인 사용 패턴,realistic-test)

test-load:
	$(call run_test,부하,load-test)

test-full:
	$(call run_test,전체 워크플로우,full-workflow-test)

# WebSocket 전문 테스트
test-ws-stress:
	$(call run_test,WebSocket 스트레스,websocket-stress-test)

test-ws-flood:
	$(call run_test,WebSocket 메시지 폭주,websocket-message-flood-test)

test-ws-reconnect:
	$(call run_test,WebSocket 재연결,websocket-reconnect-test)

# 고부하 테스트
test-high-load:
	$(call run_high_load_test,WebSocket 메시지 폭주,websocket-message-flood-test)

# 모든 테스트 실행
all: test-minimal test-websocket test-realistic test-load test-full test-ws-stress test-ws-flood test-ws-reconnect test-high-load 