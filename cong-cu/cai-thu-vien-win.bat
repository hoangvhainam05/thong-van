@echo off
setlocal
set "PROJECT_DIR=%~dp0.."
where npm.cmd >nul 2>&1
if errorlevel 1 (echo Chua co Node.js. Cai Node.js 20 tro len tai https://nodejs.org & pause & exit /b 1)
for %%D in (frontend backend) do (
  if not exist "%PROJECT_DIR%\%%D\package.json" (
    echo Khong tim thay %%D\package.json. Hay giu thu muc cong-cu trong thu muc du an.
    pause
    exit /b 1
  )
)
for %%D in (frontend backend) do (
  echo Dang cai thu vien %%D...
  pushd "%PROJECT_DIR%\%%D" || exit /b 1
  call npm.cmd install --no-audit --no-fund
  if errorlevel 1 (echo Cai thu vien %%D that bai. & popd & pause & exit /b 1)
  popd
)
echo Da cai xong thu vien.
pause
