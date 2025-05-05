#!/bin/bash

# k6 고부하 테스트 실행 스크립트 - 10k 사용자 시뮬레이션을 위한 최적화된 설정

set -e

# 기본 설정
TEST_SCRIPT="./websocket-message-flood-test.js"
TEST_TYPE="websocket-message-flood"
API_HOST="nginx"
API_PORT="5002"
CLEANUP_K6_ONLY=true
USE_TS=true
MAX_OLD_SPACE_SIZE=8192

# 인자 처리
while [[ $# -gt 0 ]]; do
  case $1 in
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
    --memory=*)
      MAX_OLD_SPACE_SIZE="${1#*=}"
      shift
      ;;
    --help)
      echo "사용법: $0 [옵션]"
      echo ""
      echo "고부하 테스트 옵션:"
      echo "  --script=파일명.js    사용자 지정 테스트 스크립트 실행 (기본값: websocket-message-flood-test.js)"
      echo "  --host=HOST          API 호스트 지정 (기본값: nginx)"
      echo "  --port=PORT          API 포트 지정 (기본값: 5002)"
      echo "  --memory=MB          k6 컨테이너용 Node.js 최대 메모리 설정 (기본값: 8192MB)"
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

echo -e "${YELLOW}k6 고부하 테스트 시작...${NC}"
echo "테스트 타입: $TEST_TYPE"
echo "테스트 스크립트: $TEST_SCRIPT"
echo "API 호스트: $API_HOST"
echo "API 포트: $API_PORT"
echo "Node.js 메모리 설정: ${MAX_OLD_SPACE_SIZE}MB"

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

# TypeScript 빌드
echo -e "${YELLOW}🔨 TypeScript 빌드 실행...${NC}"
NODE_OPTIONS="--max-old-space-size=${MAX_OLD_SPACE_SIZE}" sh -c "pnpm run build"
TEST_DIR="/dist"

# 리소스 제한 설정을 위한 도커 설정 확인
echo -e "${YELLOW}🔍 도커 시스템 리소스 확인...${NC}"
docker info | grep -E "Total Memory|CPUs"

# Influxdb와 Grafana 먼저 시작 (고성능 설정 사용)
echo -e "${YELLOW}🚀 InfluxDB 및 Grafana 컨테이너 시작...${NC}"
$DOCKER_COMPOSE_CMD -f docker-compose-high-load.yml up -d influxdb grafana --remove-orphans
echo "Grafana 대시보드가 시작되는 동안 5초 대기합니다..."
sleep 5

# 리소스 제한 설정 조정된 k6 테스트 시작
echo -e "${YELLOW}🚀 k6 고부하 테스트 실행 중... (최적화된 리소스 설정)${NC}"
echo -e "${GREEN}   Grafana 대시보드: http://localhost:3001${NC}"
echo "   프로세스를 중단하려면 Ctrl+C를 누르세요."

LOG_FILE="results/k6_log_${TEST_TYPE}_${TIMESTAMP}.txt"

# 최적화된 Docker Compose 파일로 실행
$DOCKER_COMPOSE_CMD -f docker-compose-high-load.yml run \
  -e TEST_SCRIPT=$TEST_SCRIPT \
  -e API_HOST=$API_HOST \
  -e API_PORT=$API_PORT \
  -e NODE_OPTIONS="--max-old-space-size=${MAX_OLD_SPACE_SIZE}" \
  k6 \
  run ${TEST_DIR}/${TEST_SCRIPT} \
  --no-usage-report \
  --no-summary \
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
echo "k6 컨테이너를 정리합니다. Grafana와 InfluxDB는 유지됩니다."
$DOCKER_COMPOSE_CMD -f docker-compose-high-load.yml rm -f k6 --remove-orphans

echo -e "${GREEN}고부하 테스트가 완료되었습니다.${NC}"
echo -e "${YELLOW}Grafana 대시보드를 계속 사용하려면 브라우저에서 http://localhost:3001을 열어주세요.${NC}"
echo "모든 컨테이너를 정리하려면 다음 명령을 실행하세요: $DOCKER_COMPOSE_CMD -f docker-compose-high-load.yml down"

# 테스트 결과 코드 반환
exit $TEST_EXIT_CODE 