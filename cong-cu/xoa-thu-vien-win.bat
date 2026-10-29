@echo off
setlocal
set "PROJECT_DIR=%~dp0.."
for %%D in (frontend backend) do (
  if not exist "%PROJECT_DIR%\%%D\package.json" (
    echo Khong tim thay %%D\package.json. Hay giu thu muc cong-cu trong thu muc du an.
    pause
    exit /b 1
  )
)
echo Se xoa thu vien va bo nho dem cua frontend va backend.
choice /c YN /n /m "Nhan Y de tiep tuc, N de huy: "
if errorlevel 2 exit /b 0
for %%D in (frontend backend) do (
  echo Dang xoa thu vien va bo nho dem cua %%D...
  if exist "%PROJECT_DIR%\%%D\node_modules" rmdir /s /q "%PROJECT_DIR%\%%D\node_modules"
  if exist "%PROJECT_DIR%\%%D\.npm-cache" rmdir /s /q "%PROJECT_DIR%\%%D\.npm-cache"
  if exist "%PROJECT_DIR%\%%D\node_modules" (echo Khong the xoa thu vien %%D. & pause & exit /b 1)
  if exist "%PROJECT_DIR%\%%D\.npm-cache" (echo Khong the xoa bo nho dem %%D. & pause & exit /b 1)
)
echo Da xoa xong. Dung file cai-thu-vien-win.bat de cai lai.
pause
