#!/bin/bash
# HPWD Studio - GitHub 완전 자동 배포 (토큰 기반)
#
# 사용법:
#   export GITHUB_TOKEN=ghp_your_token_here
#   export GITHUB_USER=your_username
#   ./deploy_with_token.sh [REPO_NAME]
#
# 이 스크립트는:
#   1) GitHub에 저장소 자동 생성 (이미 있으면 건너뜀)
#   2) 로컬 파일 커밋 후 push
#   3) GitHub Pages 자동 활성화
#   4) 배포 URL 출력

set -e

REPO="${1:-hpwd-studio}"

# === 환경변수 검증 ===
if [ -z "$GITHUB_TOKEN" ]; then
  echo "✗ GITHUB_TOKEN 환경변수가 필요합니다"
  echo "  export GITHUB_TOKEN=ghp_xxxxxxxxxxxx"
  exit 1
fi
if [ -z "$GITHUB_USER" ]; then
  echo "✗ GITHUB_USER 환경변수가 필요합니다"
  echo "  export GITHUB_USER=your_username"
  exit 1
fi

API="https://api.github.com"
AUTH="-H Authorization:token $GITHUB_TOKEN"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  GitHub 사용자:  $GITHUB_USER"
echo "  저장소 이름:    $REPO"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# === 1. 토큰 유효성 + 사용자 확인 ===
echo "▶ 1/5  토큰 검증..."
USER_CHECK=$(curl -s -H "Authorization: token $GITHUB_TOKEN" $API/user)
LOGIN=$(echo "$USER_CHECK" | grep -o '"login"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"\([^"]*\)".*$/\1/')
if [ -z "$LOGIN" ]; then
  echo "✗ 토큰이 유효하지 않습니다"
  echo "  응답: $USER_CHECK"
  exit 1
fi
echo "  ✓ 인증된 사용자: $LOGIN"
if [ "$LOGIN" != "$GITHUB_USER" ]; then
  echo "  ⚠ GITHUB_USER($GITHUB_USER)와 토큰 소유자($LOGIN)가 다릅니다. $LOGIN으로 진행합니다."
  GITHUB_USER="$LOGIN"
fi
echo ""

# === 2. 저장소 생성 (이미 있으면 건너뜀) ===
echo "▶ 2/5  저장소 생성..."
EXIST=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: token $GITHUB_TOKEN" \
  "$API/repos/$GITHUB_USER/$REPO")

if [ "$EXIST" = "200" ]; then
  echo "  ℹ 저장소가 이미 존재합니다. 그대로 사용합니다."
else
  CREATE=$(curl -s -X POST -H "Authorization: token $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    "$API/user/repos" \
    -d "{\"name\":\"$REPO\",\"description\":\"HPWD Studio - TRNSYS-style simulation environment\",\"private\":false,\"auto_init\":false}")
  CREATED_NAME=$(echo "$CREATE" | grep -o '"full_name"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"\([^"]*\)".*$/\1/')
  if [ -z "$CREATED_NAME" ]; then
    echo "  ✗ 저장소 생성 실패"
    echo "  응답: $CREATE" | head -5
    exit 1
  fi
  echo "  ✓ 생성됨: $CREATED_NAME"
fi
echo ""

# === 3. README의 URL 플레이스홀더 치환 ===
echo "▶ 3/5  README의 Live Demo URL 업데이트..."
if [ -f README.md ]; then
  # macOS sed와 Linux sed 호환
  if sed --version >/dev/null 2>&1; then
    sed -i "s|https://USERNAME.github.io/hpwd-studio/|https://$GITHUB_USER.github.io/$REPO/|g" README.md
  else
    sed -i '' "s|https://USERNAME.github.io/hpwd-studio/|https://$GITHUB_USER.github.io/$REPO/|g" README.md
  fi
  echo "  ✓ URL 업데이트 완료"
fi
echo ""

# === 4. Git 초기화 + push ===
echo "▶ 4/5  Git push..."
if [ ! -d .git ]; then
  git init -q
  git branch -M main
fi
git add .
git commit -q -m "Initial commit: HPWD Studio prototype" || echo "  (커밋할 변경사항 없음)"

# remote URL에 토큰 포함시켜서 인증
REMOTE_URL="https://$GITHUB_USER:$GITHUB_TOKEN@github.com/$GITHUB_USER/$REPO.git"
if git remote | grep -q '^origin$'; then
  git remote set-url origin "$REMOTE_URL"
else
  git remote add origin "$REMOTE_URL"
fi
git push -u origin main -q 2>&1 | grep -v "remote: " || true

# 토큰이 .git/config에 남지 않게 clean URL로 교체
git remote set-url origin "https://github.com/$GITHUB_USER/$REPO.git"
echo "  ✓ push 완료 (remote URL에서 토큰 제거됨)"
echo ""

# === 5. GitHub Pages 활성화 ===
echo "▶ 5/5  GitHub Pages 활성화..."
PAGES_RESP=$(curl -s -X POST -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  "$API/repos/$GITHUB_USER/$REPO/pages" \
  -d '{"source":{"branch":"main","path":"/"}}')

if echo "$PAGES_RESP" | grep -q '"html_url"'; then
  echo "  ✓ GitHub Pages 활성화됨"
elif echo "$PAGES_RESP" | grep -q "already exists"; then
  echo "  ℹ GitHub Pages가 이미 활성화되어 있습니다"
else
  echo "  ⚠ 자동 활성화 실패 (응답 확인 필요):"
  echo "$PAGES_RESP" | head -3
  echo ""
  echo "    수동 활성화: https://github.com/$GITHUB_USER/$REPO/settings/pages"
fi
echo ""

# === 완료 ===
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✓ 배포 완료"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  저장소:  https://github.com/$GITHUB_USER/$REPO"
echo "  라이브:  https://$GITHUB_USER.github.io/$REPO/"
echo ""
echo "  ℹ GitHub Pages 첫 배포는 1-3분 걸립니다. 기다렸다가 접속해보세요."
echo ""
