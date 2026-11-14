@echo off
chcp 65001 >nul
rem Team Chat - ติดตั้งระบบจริงรวดเดียว (บอท Telegram + Google Drive + ค่าลับ + Edge Function + webhook) · โดย ลุงพี
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\setup-all.ps1"
