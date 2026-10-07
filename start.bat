@echo off
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js 18 ou superior nao foi encontrado.
  echo Use o arquivo standalone\Imob_Velocity_V5_Standalone.html para jogar localmente sem servidor.
  pause
  exit /b 1
)
node server.js
pause
