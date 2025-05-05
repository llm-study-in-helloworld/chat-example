#!/bin/bash

# k6 부하 테스트 실행 스크립트

set -e

# 기본 설정
TEST_SCRIPT="./minimal-test.js"
TEST_TYPE="minimal"
API_HOST="nginx"
API_PORT="5002"
CLEANUP_K6_ONLY=true
USE_TS=true  # Default to using TypeScript version

# 인자 처리
while [[ $# -gt 0 ]]; do
  case $1 in
    --websocket)
      TEST_SCRIPT="./websocket-test.js"
      TEST_TYPE="websocket"
      shift
      ;;
    --ws-stress)
      TEST_SCRIPT="./websocket-stress-test.js"
      TEST_TYPE="websocket-stress"
      shift
      ;;
    --ws-flood)
      TEST_SCRIPT="./websocket-message-flood-test.js"
      TEST_TYPE="websocket-message-flood"
      shift
      ;;
    --ws-reconnect)
      TEST_SCRIPT="./websocket-reconnect-test.js"
      TEST_TYPE="websocket-reconnect"
      shift
      ;;
    --minimal)
      TEST_SCRIPT="./minimal-test.js"
      TEST_TYPE="minimal"
      # For minimal test, use very short duration
      shift
      ;;
    --realistic)
      TEST_SCRIPT="./realistic-test.js"
      TEST_TYPE="realistic"
      shift
      ;;
    --load)
      TEST_SCRIPT="./load-test.js"
      TEST_TYPE="load"
      shift
      ;;
    --full)
      TEST_SCRIPT="./full-workflow-test.js"
      TEST_TYPE="full"
      shift
      ;;
    --script=*)
      TEST_SCRIPT="${1#*=}"
      TEST_TYPE=$(basename "$TEST_SCRIPT" .js)
      shift
      ;;
    --host=*)
      API_HOST="${1#*=}"
      shift
      ;;
    --port=*)
      API_PORT="${1#*=}"
      shift
      ;;
    --no-ts)
      USE_TS=false
      shift
      ;;
    --cleanup-all)
      CLEANUP_K6_ONLY=false
      shift
      ;;
    --help)
      echo "사용법: $0 [옵션]"
      echo ""
      echo "기본 테스트 옵션:"
      echo "  --minimal            최소한의 테스트 실행 (기본값)"
      echo "  --websocket          기본 WebSocket 테스트 실행"
      echo "  --realistic          현실적인 사용 패턴 테스트"
      echo "  --load               부하 테스트 실행"
      echo "  --full               전체 워크플로우 테스트 실행"
      echo ""
      echo "WebSocket 특화 테스트 옵션:"
      echo "  --ws-stress          WebSocket 스트레스 테스트 (최대 200명 동시 사용자)"
      echo "  --ws-flood           WebSocket 메시지 폭주 테스트 (메시지 처리량 테스트)"
      echo "  --ws-reconnect       WebSocket 재연결 테스트 (연결 안정성 테스트)"
      echo ""
      echo "일반 옵션:"
      echo "  --script=파일명.js    사용자 지정 테스트 스크립트 실행"
      echo "  --host=HOST          API 호스트 지정 (기본값: nginx)"
      echo "  --port=PORT          API 포트 지정 (기본값: 5002)"
      echo "  --no-ts              TypeScript 빌드 단계 건너뛰기"
      echo "  --cleanup-all        테스트 후 모든 컨테이너 정리"
      exit 1
      ;;
    *)
      echo "알 수 없는 옵션: $1"
      echo "사용법을 보려면 --help 옵션을 사용하세요."
      exit 1
      ;;
  esac
done

# 텍스트 색상 설정
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}k6 채팅 앱 부하 테스트 시작...${NC}"
echo "테스트 타입: $TEST_TYPE"
echo "테스트 스크립트: $TEST_SCRIPT"
echo "API 호스트: $API_HOST"
echo "API 포트: $API_PORT"
echo "TypeScript 사용: $USE_TS"

# Docker 명령어 확인
DOCKER_COMPOSE_CMD="docker compose"
if ! command -v docker &> /dev/null; then
  echo -e "${RED}Docker가 설치되어 있지 않습니다. 설치 후 다시 시도해주세요.${NC}"
  exit 1
fi

# 결과 및 로그 디렉토리 생성
mkdir -p results

# 이전 테스트 결과 백업
TIMESTAMP=$(date "+%Y%m%d_%H%M%S")
BACKUP_DIR="results/backup_${TIMESTAMP}"
if [ -e "results/latest" ]; then
  mkdir -p "${BACKUP_DIR}"
  cp results/latest/* "${BACKUP_DIR}/" 2>/dev/null || true
  echo "📁 이전 테스트 결과를 백업했습니다: $(pwd)/${BACKUP_DIR}"
fi
mkdir -p results/latest

# TypeScript 빌드 (필요한 경우)
if [ "$USE_TS" = true ]; then
  echo -e "${YELLOW}🔨 TypeScript 빌드 실행...${NC}"
  sh -c "pnpm run build"
  # 스크립트 경로 변경
  TEST_DIR="/dist"
fi

# Influxdb와 Grafana 먼저 시작
echo -e "${YELLOW}🚀 InfluxDB 및 Grafana 컨테이너 시작...${NC}"
$DOCKER_COMPOSE_CMD -f docker-compose-k6.yml up -d influxdb grafana  --remove-orphans
echo "Grafana 대시보드가 시작되는 동안 5초 대기합니다..."
sleep 5  # Grafana가 시작될 때까지 충분히 대기

# k6 테스트 시작
echo -e "${YELLOW}🚀 k6 부하 테스트 실행 중...${NC}"
echo -e "${GREEN}   Grafana 대시보드: http://localhost:3001${NC}"
echo "   프로세스를 중단하려면 Ctrl+C를 누르세요."

LOG_FILE="results/k6_log_${TEST_TYPE}_${TIMESTAMP}.txt"
$DOCKER_COMPOSE_CMD -f docker-compose-k6.yml run \
  -e TEST_SCRIPT=$TEST_SCRIPT \
  -e API_HOST=$API_HOST \
  -e API_PORT=$API_PORT \
  k6 \
  run ${TEST_DIR}/${TEST_SCRIPT} \
  | tee "$LOG_FILE"

TEST_EXIT_CODE=${PIPESTATUS[0]}
cp "$LOG_FILE" "results/latest/"

# 테스트 결과 분석
if grep -q "0 scenarios failed" "$LOG_FILE" 2>/dev/null || grep -q "'response code is 200'\s*\S\s*100%" "$LOG_FILE"; then
  echo -e "${GREEN}✅ 테스트가 성공적으로 완료되었습니다!${NC}"
  echo -e "${GREEN}   결과: 성공${NC}"
elif [ $TEST_EXIT_CODE -ne 0 ]; then
  echo -e "${RED}❌ 테스트 실행 중 오류가 발생했습니다. 로그를 확인해주세요.${NC}"
  echo -e "${RED}   결과: 실패${NC}"
  echo "   로그 파일: $(pwd)/$LOG_FILE"
else
  echo -e "${YELLOW}❓ 테스트 결과가 명확하지 않습니다. 로그를 확인해주세요.${NC}"
  echo "   로그 파일: $(pwd)/$LOG_FILE"
fi

# k6 컨테이너만 정리하고 Grafana와 InfluxDB는 유지
if [ "$CLEANUP_K6_ONLY" = true ]; then
  echo "k6 컨테이너를 정리합니다. Grafana와 InfluxDB는 유지됩니다."
  $DOCKER_COMPOSE_CMD -f docker-compose-k6.yml rm -f k6 --remove-orphans
else
  echo "모든 테스트 컨테이너를 정리합니다."
  $DOCKER_COMPOSE_CMD -f docker-compose-k6.yml down --remove-orphans
fi

echo -e "${GREEN}부하 테스트가 완료되었습니다.${NC}"
echo -e "${YELLOW}Grafana 대시보드를 계속 사용하려면 브라우저에서 http://localhost:3001을 열어주세요.${NC}"
echo "모든 컨테이너를 정리하려면 다음 명령을 실행하세요: $DOCKER_COMPOSE_CMD -f docker-compose-k6.yml down"

# 테스트 결과 코드 반환
exit $TEST_EXIT_CODE 