@echo off
setlocal
cd /d "%~dp0.." || (echo Khong tim thay thu muc du an. & pause & exit /b 1)
where git >nul 2>&1
if errorlevel 1 (echo Chua co Git. Hay cai Git roi chay lai. & pause & exit /b 1)
git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (echo Khong tim thay kho Git. Hay giu thu muc cong-cu trong thu muc du an da clone. & pause & exit /b 1)
echo Dang tai va cap nhat code cho nhanh hien tai...
git pull --ff-only
if errorlevel 1 (
  echo Khong the cap nhat. Kiem tra ket noi, nhanh theo doi va cac thay doi dang co.
  echo Neu co xung dot hoac nhanh da tach lich su, hay xu ly thu cong roi chay lai.
  pause
  exit /b 1
)
echo Da cap nhat code.
pause
