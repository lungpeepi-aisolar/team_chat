@echo off
chcp 65001 >nul
rem Team Chat - ตั้ง/เปลี่ยนรหัสทีม (เปิดจากเบราว์เซอร์นอก Telegram) + อัป Edge Function ล่าสุด · โดย ลุงพี
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\team-pin.ps1"
