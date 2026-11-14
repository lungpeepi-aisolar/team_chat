@echo off
chcp 65001 >nul
rem Team Chat - เปิดตัวอย่างในเครื่อง (โดย ลุงพี) · ดับเบิลคลิกได้เลย
cd /d "%~dp0"
set PORT=8790
title Team Chat (ตัวอย่าง) - http://127.0.0.1:%PORT%
echo เปิด Team Chat ที่ http://127.0.0.1:%PORT%  (ปิดหน้าต่างนี้ = ปิดโปรแกรม)
start "" http://127.0.0.1:%PORT%/
where py >nul 2>&1 && (py -m http.server %PORT% --bind 127.0.0.1 --directory web) || (python -m http.server %PORT% --bind 127.0.0.1 --directory web)
pause
