@echo off
setlocal EnableExtensions
cd /d "%~dp0"

REM Ensure Rust/Cargo is on PATH (common after rustup install without restarting the terminal)
if exist "%USERPROFILE%\.cargo\bin\cargo.exe" (
  set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
)

:menu
cls
echo ========================================
echo   NovaBlend Studio Launcher
echo ========================================
echo.
echo   1  Run locally  (npm run tauri dev)
echo   2  Build release (src-tauri\target\release)
echo   0  Close
echo.
set /p choice="Select option: "

if "%choice%"=="1" goto run_dev
if "%choice%"=="2" goto run_build
if "%choice%"=="0" goto goodbye
echo.
echo Invalid choice. Press any key...
pause >nul
goto menu

:ensure_tools
where cargo >nul 2>&1
if errorlevel 1 (
  echo ERROR: cargo was not found.
  echo Install Rust from https://rustup.rs then reopen this launcher.
  echo.
  pause
  goto menu
)

where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: node was not found. Install Node.js first.
  echo.
  pause
  goto menu
)

if not exist "node_modules\" (
  echo Installing npm dependencies...
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    goto menu
  )
)
goto :eof

:run_dev
echo.
call :ensure_tools
echo Starting NovaBlend Studio...
call npm run tauri dev
echo.
pause
goto menu

:run_build
echo.
call :ensure_tools
echo Building release to:
echo   %CD%\src-tauri\target\release
echo.
call npm run tauri build
if errorlevel 1 (
  echo.
  echo Build failed.
  pause
  goto menu
)
echo.
echo Build finished.
echo   App:      src-tauri\target\release\novablend-studio.exe
echo   FFmpeg:   src-tauri\target\release\ffmpeg.exe
echo   NSIS:     src-tauri\target\release\bundle\nsis\
echo   MSI:      src-tauri\target\release\bundle\msi\
echo.
explorer "%CD%\src-tauri\target\release"
pause
goto menu

:goodbye
endlocal
exit /b 0
