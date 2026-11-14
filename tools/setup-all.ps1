# Team Chat - ติดตั้งระบบจริงรวดเดียว (SETUP.md ขั้นที่ 4-7) · โดย ลุงพี
# เรียกจาก setup-all.bat · รันซ้ำได้: ขั้นที่ทำเสร็จแล้ว (มีค่าใน Supabase Secrets) จะข้ามเอง
# ค่าลับพิมพ์/อ่านในเครื่องนี้เท่านั้น → ส่งเข้า Supabase Secrets ทันที → ลบไฟล์ชั่วคราวทิ้ง
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$env:npm_config_cache = Join-Path (Split-Path -Parent $root) '.npm-cache'
$P = 'emlwnczeckucjycwjzmd'
$FN = "https://$P.supabase.co/functions/v1/teamchat"
$envFile = Join-Path $root '.secrets.tmp.env'
$urlFile = Join-Path $root '.drive-folder.tmp'

function Say($t, $c = 'Cyan') { Write-Host $t -ForegroundColor $c }
function Invoke-Supa { & npx -y supabase@3.1.0 @args; if ($LASTEXITCODE) { throw "คำสั่ง supabase $($args[0]) ไม่สำเร็จ" } }
function ReadSecret($prompt) {
  $s = Read-Host $prompt -AsSecureString
  [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)).Trim()
}
function Tg($tok, $method, $body = @{}) {
  Invoke-RestMethod -Method Post -Uri "https://api.telegram.org/bot$tok/$method" -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes(($body | ConvertTo-Json -Compress)))
}
function SecretNames {  # ชื่อ secrets ที่มีแล้ว (ไม่อ่านค่า)
  $out = & cmd /c "npx -y supabase@3.1.0 secrets list --remote=$P 2>nul"
  ($out | Out-String)
}
function PushSecrets($lines) {
  [IO.File]::WriteAllLines($envFile, $lines)
  try { Invoke-Supa secrets set --env-file $envFile "--remote=$P" --yes } finally { Remove-Item $envFile -ErrorAction SilentlyContinue }
}

try {
  Remove-Item $envFile, $urlFile -ErrorAction SilentlyContinue

  # ── 1. Supabase ──
  Say "`n[1/5] ล็อกอิน Supabase (ครั้งแรกเบราว์เซอร์จะเปิดให้กดยืนยัน)"
  & cmd /c "npx -y supabase@3.1.0 projects list >nul 2>&1"
  if ($LASTEXITCODE) { Invoke-Supa login }
  Say "  ✔ Supabase พร้อม" Green
  $have = SecretNames

  # ── 2. Telegram ──
  if ($have -match 'TELEGRAM_BOT_TOKEN' -and $have -match 'TELEGRAM_WEBHOOK_SECRET') {
    Say "`n[2/5] Telegram — ตั้งไว้แล้ว ข้าม ✔" Green
  } else {
    Say "`n[2/5] Telegram — บอทต้องอยู่ในกลุ่มทีมแล้ว"
    $tok = ReadSecret 'วาง bot token จาก @BotFather (จะไม่แสดงบนจอ)'
    $bot = (Tg $tok 'getMe').result
    Say "  ✔ บอท @$($bot.username)" Green
    Tg $tok 'deleteWebhook' | Out-Null
    $groups = @()
    while (-not $groups.Count) {
      $ups = (Tg $tok 'getUpdates' @{ allowed_updates = @('message', 'my_chat_member') }).result
      $msgs = @($ups | ForEach-Object { if ($_.message) { $_.message } elseif ($_.my_chat_member) { $_.my_chat_member } } | Where-Object { $_.chat.type -in 'group', 'supergroup' })
      $groups = @($msgs | Group-Object { $_.chat.id } | ForEach-Object { $_.Group[-1] })
      if (-not $groups.Count) { Read-Host '  ยังไม่เจอกลุ่ม → พิมพ์ข้อความอะไรก็ได้ในกลุ่มที่มีบอท แล้วกด Enter ที่นี่' | Out-Null }
    }
    if ($groups.Count -gt 1) {
      for ($i = 0; $i -lt $groups.Count; $i++) { Write-Host "   $($i + 1)) $($groups[$i].chat.title)  ($($groups[$i].chat.id))" }
      $pick = $groups[[int](Read-Host '  เลือกกลุ่มทีม (เลข)') - 1]
    } else { $pick = $groups[0] }
    $chatId = $pick.chat.id
    Say "  ✔ กลุ่ม: $($pick.chat.title) ($chatId)" Green
    $from = $pick.from; $admin = ''
    if ($from -and -not $from.is_bot) {
      $ans = Read-Host "  ให้ $($from.first_name) $($from.last_name) (tg:$($from.id)) เป็นผู้ดูแลคนแรก? [Y/n]"
      if ($ans -notmatch '^[nN]') { $admin = "tg:$($from.id)" }
    }
    if (-not $admin) { $admin = 'tg:' + (Read-Host '  ใส่ไอดี Telegram ของผู้ดูแล (ตัวเลขจาก @userinfobot)').Trim() }
    $appLink = "https://t.me/$($bot.username)/chat"
    $whSecret = -join ((1..40) | ForEach-Object { '{0:x}' -f (Get-Random -Maximum 16) })
    PushSecrets @("TELEGRAM_BOT_TOKEN=$tok", "TELEGRAM_CHAT_ID=$chatId", "TELEGRAM_WEBHOOK_SECRET=$whSecret", "TELEGRAM_APP_LINK=$appLink", "ADMIN_IDS=$admin")
    $wh = Tg $tok 'setWebhook' @{ url = "$FN/tg-webhook"; secret_token = $whSecret; allowed_updates = @('message') }
    if (-not $wh.ok) { throw 'setWebhook ไม่สำเร็จ' }
    Say "  ✔ บันทึก Telegram ลง Supabase Secrets + ตั้ง webhook แล้ว (รันซ้ำจะข้ามขั้นนี้)" Green
  }

  # ── 3. Google Drive ──
  if ($have -match 'GOOGLE_REFRESH_TOKEN' -and $have -match 'DRIVE_FOLDER_ID') {
    Say "`n[3/5] Google Drive — ตั้งไว้แล้ว ข้าม ✔" Green
  } else {
    Say "`n[3/5] Google Drive"
    & py -I tools\get_google_token.py --env $envFile --folder-url $urlFile
    if ($LASTEXITCODE) { throw 'ขั้น Google Drive ไม่สำเร็จ' }
    PushSecrets (Get-Content $envFile)
    $folderUrl = (Get-Content $urlFile -Raw).Trim()
    if ($folderUrl) {
      $cfg = Join-Path $root 'web\config.js'
      $txt = [IO.File]::ReadAllText($cfg)
      $txt = $txt -replace "driveRootUrl: '[^']*'", "driveRootUrl: '$folderUrl'"
      [IO.File]::WriteAllText($cfg, $txt, (New-Object Text.UTF8Encoding $false))
    }
    Say "  ✔ บันทึก Google Drive ลง Supabase Secrets แล้ว" Green
  }

  # ── 4. Edge Function ──
  Say "`n[4/5] อัป Edge Function teamchat (1-2 นาที)"
  Invoke-Supa functions deploy teamchat --no-verify-jwt --use-api "--remote=$P" --yes
  Say "  ✔ อัปแล้ว" Green

  # ── 5. ทดสอบ ──
  Say "`n[5/5] ทดสอบ"
  try { Invoke-RestMethod -Method Post -Uri "$FN/op/hello" -Body '{}' -ContentType 'application/json' | Out-Null; Say '  ⚠ Edge Function ไม่ตรวจสิทธิ์?' Yellow }
  catch { if ($_.Exception.Response.StatusCode.value__ -eq 401) { Say '  ✔ Edge Function ตอบแล้ว (401 = ตรวจสิทธิ์ทำงาน)' Green } else { Say "  ⚠ Edge Function: $($_.Exception.Message)" Yellow } }

  Say "`n════════ เสร็จแล้ว ════════" Green
  Write-Host "  บอก Claude ว่า 'ติดตั้งเสร็จแล้ว' ได้เลย (ไม่ต้องส่งค่าลับ)"
}
catch {
  Say "`n*** ไม่สำเร็จ: $($_.Exception.Message)" Red
  Say '    ก็อปข้อความนี้ส่งให้ Claude (ไม่มีค่าลับแสดงบนจอ) · รันใหม่ได้ ขั้นที่เสร็จแล้วจะข้ามเอง' Yellow
}
finally {
  Remove-Item $envFile, $urlFile -ErrorAction SilentlyContinue
}
Read-Host "`nกด Enter เพื่อปิด"
