@echo off
setlocal
cd /d "%~dp0..\frontend" || (echo Khong tim thay thu muc frontend. & pause & exit /b 1)
where npm.cmd >nul 2>&1
if errorlevel 1 (
  echo Chua co Node.js. Cai Node.js 20 tro len tai https://nodejs.org
  pause
  exit /b 1
)
if not exist "node_modules\next" (
  echo Dang cai thu vien giao dien...
  call npm.cmd install --no-audit --no-fund
  if errorlevel 1 (echo Cai thu vien that bai. & pause & exit /b 1)
)
echo Mo http://localhost:3000 - nhan Ctrl+C hoac dong cua so de dung.
call npm.cmd run dev
if errorlevel 1 (echo Khong the chay giao dien. & pause & exit /b 1)
