@echo off
chcp 65001 >nul
rem Team Chat - อัป Edge Function "teamchat" ขึ้น Supabase (โดย ลุงพี) · ดับเบิลคลิกได้ · รันซ้ำได้ทุกครั้งที่แก้ index.ts
cd /d "%~dp0"
set npm_config_cache=%~dp0..\.npm-cache
set PROJECT=emlwnczeckucjycwjzmd
set CLI=npx -y supabase@3.1.0
echo.
echo [1/3] ล็อกอิน Supabase (ครั้งแรกจะเปิดเบราว์เซอร์ให้กดยืนยัน · ครั้งต่อไปข้ามเอง)
call %CLI% projects list >nul 2>&1 || call %CLI% login || goto :err
echo [2/3] ผูกกับ project %PROJECT%
call %CLI% link --project-ref %PROJECT% || goto :err
echo [3/3] อัป Edge Function teamchat
call %CLI% functions deploy teamchat --no-verify-jwt --project-ref %PROJECT% || goto :err
echo.
echo เสร็จแล้ว: https://%PROJECT%.supabase.co/functions/v1/teamchat
echo ค่าลับ (Secrets) ใส่ที่ https://supabase.com/dashboard/project/%PROJECT%/functions/secrets
pause
exit /b 0
:err
echo.
echo *** ไม่สำเร็จ - ถ่ายภาพหน้าจอนี้ส่งให้ Claude ***
pause
exit /b 1
