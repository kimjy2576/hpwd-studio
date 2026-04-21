#!/bin/bash
# HPWD Studio - GitHub 자동 배포 스크립트 (macOS / Linux)
#
# 사용법:
#   1) GitHub에서 빈 저장소 하나를 먼저 만듭니다 (README 등 체크 해제)
#   2) 이 파일이 있는 폴더에서 아래 명령 실행:
#      ./deploy.sh YOUR_USERNAME REPO_NAME
#   예: ./deploy.sh jyk2576 hpwd-studio

set -e

USERNAME="${1:-}"
REPO="${2:-hpwd-studio}"

if [ -z "$USERNAME" ]; then
  echo "✗ 사용법: ./deploy.sh YOUR_USERNAME [REPO_NAME]"
  echo "  예시:   ./deploy.sh jyk2576 hpwd-studio"
  exit 1
fi

echo "▶ GitHub 사용자:  $USERNAME"
echo "▶ 저장소 이름:    $REPO"
echo ""

# README의 USERNAME 플레이스홀더 자동 치환
if [ -f README.md ]; then
  sed -i.bak "s|https://USERNAME.github.io/hpwd-studio/|https://$USERNAME.github.io/$REPO/|g" README.md
  rm -f README.md.bak
  echo "✓ README.md의 Live Demo URL 업데이트 완료"
fi

# Git 초기화 (기존 .git이 있으면 건너뜀)
if [ ! -d .git ]; then
  git init
  echo "✓ git init"
fi

git add .
git commit -m "Initial commit: HPWD Studio prototype" || echo "  (commit할 변경사항 없음)"
git branch -M main

# remote 설정 (기존에 있으면 교체)
if git remote | grep -q '^origin$'; then
  git remote set-url origin "https://github.com/$USERNAME/$REPO.git"
else
  git remote add origin "https://github.com/$USERNAME/$REPO.git"
fi
echo "✓ remote 설정: https://github.com/$USERNAME/$REPO.git"

echo ""
echo "▶ push 시작 (GitHub 인증이 필요할 수 있습니다)..."
git push -u origin main

echo ""
echo "✓ push 완료!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  다음 단계: GitHub Pages 활성화"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  1) 브라우저로 이동:"
echo "     https://github.com/$USERNAME/$REPO/settings/pages"
echo ""
echo "  2) Source: 'Deploy from a branch'"
echo "     Branch: main  /  (root)"
echo "     → Save 클릭"
echo ""
echo "  3) 1-2분 후 배포 URL:"
echo "     https://$USERNAME.github.io/$REPO/"
echo ""
