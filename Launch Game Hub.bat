@echo off
cd /d "%~dp0"
title Game Hub

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js isn't installed on this PC.
  echo Download it from https://nodejs.org (the LTS version), install it, then run this again.
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Setting up Game Hub for the first time - this can take a few minutes...
  call npm install
  if errorlevel 1 (
    echo.
    echo Something went wrong during setup. Press any key to close.
    pause >nul
    exit /b 1
  )
)

if not exist src\generated\prisma (
  call npx prisma generate
)

echo.
echo Starting Game Hub...
call npm run desktop
if errorlevel 1 (
  echo.
  echo Game Hub closed with an error. Press any key to close this window.
  pause >nul
)
