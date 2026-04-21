@echo off
REM HPWD Studio - GitHub 자동 배포 스크립트 (Windows)
REM
REM 사용법:
REM   1) GitHub에서 빈 저장소 하나를 먼저 만듭니다 (README 체크 해제)
REM   2) 이 파일이 있는 폴더에서 명령 프롬프트 실행:
REM      deploy.bat YOUR_USERNAME REPO_NAME
REM   예: deploy.bat jyk2576 hpwd-studio

setlocal

set USERNAME=%1
set REPO=%2
if "%REPO%"=="" set REPO=hpwd-studio

if "%USERNAME%"=="" (
  echo 사용법: deploy.bat YOUR_USERNAME [REPO_NAME]
  echo 예시:   deploy.bat jyk2576 hpwd-studio
  exit /b 1
)

echo GitHub 사용자:  %USERNAME%
echo 저장소 이름:    %REPO%
echo.

REM Git 초기화
if not exist .git (
  git init
  echo - git init 완료
)

git add .
git commit -m "Initial commit: HPWD Studio prototype"
git branch -M main

git remote remove origin 2>nul
git remote add origin https://github.com/%USERNAME%/%REPO%.git
echo - remote 설정: https://github.com/%USERNAME%/%REPO%.git
echo.

echo Push 시작 (GitHub 인증이 필요할 수 있습니다)...
git push -u origin main

echo.
echo ===============================================
echo  다음 단계: GitHub Pages 활성화
echo ===============================================
echo.
echo  1) 브라우저로 이동:
echo     https://github.com/%USERNAME%/%REPO%/settings/pages
echo.
echo  2) Source: Deploy from a branch
echo     Branch: main  /  (root)
echo     - Save 클릭
echo.
echo  3) 1-2분 후 배포 URL:
echo     https://%USERNAME%.github.io/%REPO%/
echo.

endlocal
