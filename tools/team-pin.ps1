# Team Chat - ตั้ง/เปลี่ยนรหัสทีม (เปิดแอปจากเบราว์เซอร์นอก Telegram) + อัป Edge Function ล่าสุด · โดย ลุงพี
# รหัสพิมพ์ในหน้าต่างนี้เท่านั้น → Supabase Secrets (TEAM_PIN) → ไม่บันทึกลงไฟล์ใดๆ
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$env:npm_config_cache = Join-Path (Split-Path -Parent $root) '.npm-cache'
$P = 'emlwnczeckucjycwjzmd'
function Say($t, $c = 'Cyan') { Write-Host $t -ForegroundColor $c }
function Invoke-Supa {  # ต้องคัดลอก $args ก่อน splat (npx เป็น .ps1)
  $a = @($args); & npx -y supabase@3.1.0 @a
  if ($LASTEXITCODE) { throw "คำสั่ง supabase $($a[0]) ไม่สำเร็จ" }
}
function ReadSecret($prompt) {
  $s = Read-Host $prompt -AsSecureString
  [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)).Trim()
}
try {
  & cmd /c "npx -y supabase@3.1.0 projects list >nul 2>&1"
  if ($LASTEXITCODE) { Invoke-Supa login }
  Say "`nตั้งรหัสทีม — ทีมงานใช้รหัสนี้เปิด Team Chat จากเบราว์เซอร์ (ใน Telegram ไม่ต้องใช้รหัส)"
  Say "  แนะนำ 6 ตัวขึ้นไป · ตัวอักษร/ตัวเลข · เปลี่ยนเมื่อไรก็รันไฟล์นี้ใหม่" Gray
  while ($true) {
    $p1 = ReadSecret 'พิมพ์รหัสทีม (ไม่แสดงบนจอ)'
    if ($p1.Length -lt 6) { Say '  สั้นไป ต้อง 6 ตัวขึ้นไป' Yellow; continue }
    $p2 = ReadSecret 'พิมพ์ซ้ำอีกครั้ง'
    if ($p1 -ceq $p2) { break }
    Say '  สองครั้งไม่ตรงกัน ลองใหม่' Yellow
  }
  Say "`n[1/2] บันทึกรหัสทีมลง Supabase Secrets"
  Invoke-Supa secrets set "TEAM_PIN=$p1" "--remote=$P" --yes
  Say '  ✔ บันทึกแล้ว' Green
  Say "`n[2/2] อัป Edge Function ล่าสุด (1-2 นาที)"
  Invoke-Supa functions deploy teamchat --no-verify-jwt --use-api "--remote=$P" --yes
  Say '  ✔ อัปแล้ว' Green
  Say "`n════ เสร็จแล้ว ════  บอกรหัสให้ทีมทางช่องทางส่วนตัว (ไม่ต้องบอก Claude)" Green
}
catch { Say "`n*** ไม่สำเร็จ: $($_.Exception.Message)" Red; Say '    ก็อปข้อความนี้ส่งให้ Claude ได้ (ไม่มีรหัสบนจอ)' Yellow }
Read-Host "`nกด Enter เพื่อปิด"
