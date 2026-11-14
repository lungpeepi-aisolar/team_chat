@echo off
chcp 65001 >nul
rem Team Chat - ขอสิทธิ์ Google Drive + สร้างโฟลเดอร์ "Team Chat" (โดย ลุงพี) · ดับเบิลคลิก แล้ววาง Client ID / Secret
cd /d "%~dp0"
echo ใช้บัญชี Google ของบริษัท (peerapong@proinventive.co.th) ถ้าเข้าไม่ได้ค่อยใช้ lungpee.pi@gmail.com
echo.
set /p CID=วาง Client ID แล้วกด Enter:
set /p CSEC=วาง Client secret แล้วกด Enter:
py -I tools\get_google_token.py "%CID%" "%CSEC%"
