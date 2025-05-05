#!/bin/bash

# 로그 파일 마이그레이션 스크립트 - 이전 로그 파일을 새 폴더 구조로 이동

set -e

# 텍스트 색상 설정
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}기존 로그 파일을 새 폴더 구조로 마이그레이션합니다...${NC}"

# 이전 로그 파일 확인
OLD_LOGS_DIR="results"
OLD_LOGS_LATEST="results/latest"
OLD_BACKUP_DIRS="results/backup_*"

# 이전 형식: results/k6_log_TEST_TYPE_TIMESTAMP.txt
# 새 형식: results/TEST_TYPE-test/TIMESTAMP.log

# 기존 로그 파일 이동
for log_file in "$OLD_LOGS_DIR"/k6_log_*_*.txt; do
  if [ -f "$log_file" ]; then
    filename=$(basename "$log_file")
    
    # 파일 이름에서 테스트 타입 추출 (k6_log_TEST_TYPE_TIMESTAMP.txt)
    TEST_TYPE=$(echo "$filename" | sed -E 's/k6_log_([^_]+)_.+\.txt/\1/')
    
    # 테스트 타입에 -test 접미사 추가
    TEST_TYPE="${TEST_TYPE}-test"
    
    # 타임스탬프 추출
    TIMESTAMP=$(echo "$filename" | sed -E 's/k6_log_[^_]+_(.+)\.txt/\1/')
    
    # 새 폴더 생성
    NEW_DIR="$OLD_LOGS_DIR/$TEST_TYPE"
    mkdir -p "$NEW_DIR/backups"
    
    # 새 파일 이름
    NEW_FILE="$NEW_DIR/$TIMESTAMP.log"
    
    echo "이동: $log_file -> $NEW_FILE"
    cp "$log_file" "$NEW_FILE"
  fi
done

# latest 폴더의 로그 파일 이동
if [ -d "$OLD_LOGS_LATEST" ]; then
  for log_file in "$OLD_LOGS_LATEST"/k6_log_*_*.txt; do
    if [ -f "$log_file" ]; then
      filename=$(basename "$log_file")
      
      # 파일 이름에서 테스트 타입 추출 (k6_log_TEST_TYPE_TIMESTAMP.txt)
      TEST_TYPE=$(echo "$filename" | sed -E 's/k6_log_([^_]+)_.+\.txt/\1/')
      
      # 테스트 타입에 -test 접미사 추가
      TEST_TYPE="${TEST_TYPE}-test"
      
      # 타임스탬프 추출
      TIMESTAMP=$(echo "$filename" | sed -E 's/k6_log_[^_]+_(.+)\.txt/\1/')
      
      # 새 폴더 생성
      NEW_DIR="$OLD_LOGS_DIR/$TEST_TYPE"
      mkdir -p "$NEW_DIR/backups"
      
      # 새 파일 이름
      NEW_FILE="$NEW_DIR/$TIMESTAMP.log"
      
      echo "이동: $log_file -> $NEW_FILE"
      cp "$log_file" "$NEW_FILE"
    fi
  done
fi

# 백업 폴더 로그 파일 이동
for backup_dir in $OLD_BACKUP_DIRS; do
  if [ -d "$backup_dir" ]; then
    for log_file in "$backup_dir"/k6_log_*_*.txt; do
      if [ -f "$log_file" ]; then
        filename=$(basename "$log_file")
        
        # 파일 이름에서 테스트 타입 추출 (k6_log_TEST_TYPE_TIMESTAMP.txt)
        TEST_TYPE=$(echo "$filename" | sed -E 's/k6_log_([^_]+)_.+\.txt/\1/')
        
        # 테스트 타입에 -test 접미사 추가
        TEST_TYPE="${TEST_TYPE}-test"
        
        # 새 백업 폴더 생성
        NEW_BACKUPS_DIR="$OLD_LOGS_DIR/$TEST_TYPE/backups"
        mkdir -p "$NEW_BACKUPS_DIR"
        
        echo "백업: $log_file -> $NEW_BACKUPS_DIR/$filename"
        cp "$log_file" "$NEW_BACKUPS_DIR/$filename"
      fi
    done
  fi
done

echo -e "${GREEN}마이그레이션 완료!${NC}"
echo "이전 폴더 구조를 삭제하려면 다음 명령을 실행하세요:"
echo "rm -rf $OLD_LOGS_LATEST $OLD_BACKUP_DIRS" 