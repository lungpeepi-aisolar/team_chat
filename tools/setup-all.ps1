# Team Chat - ติดตั้งระบบจริงรวดเดียว (SETUP.md ขั้นที่ 4-7) · โดย ลุงพี
# เรียกจาก setup-all.bat · ค่าลับทั้งหมดพิมพ์ในหน้าต่างนี้เท่านั้น → ส่งเข้า Supabase Secrets → ลบไฟล์ชั่วคราวทิ้ง
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
function Cli { & npx -y supabase@3.1.0 @args; if ($LASTEXITCODE) { throw "คำสั่ง supabase $($args[0]) ไม่สำเร็จ" } }
function ReadSecret($prompt) {
  $s = Read-Host $prompt -AsSecureString
  [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)).Trim()
}
function Tg($tok, $method, $body = @{}) {
  Invoke-RestMethod -Method Post -Uri "https://api.telegram.org/bot$tok/$method" -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes(($body | ConvertTo-Json -Compress)))
}

try {
  Remove-Item $envFile, $urlFile -ErrorAction SilentlyContinue

  # ── 1. Supabase ──
  Say "`n[1/6] ล็อกอิน Supabase (ครั้งแรกเบราว์เซอร์จะเปิดให้กดยืนยัน)"
  # ตรวจว่าล็อกอินแล้วหรือยัง ผ่าน cmd (PowerShell 5.1 จะโยน error ถ้าดัก stderr ของ npx เอง)
  & cmd /c "npx -y supabase@3.1.0 projects list >nul 2>&1"
  if ($LASTEXITCODE) { Cli login }
  Say "  ✔ Supabase พร้อม" Green

  # ── 2. Telegram ──
  Say "`n[2/6] Telegram — ต้องสร้างบอทกับ @BotFather + เพิ่มบอทเข้ากลุ่มทีม + /setprivacy Disable ไว้ก่อน"
  $tok = ReadSecret 'วาง bot token จาก @BotFather (จะไม่แสดงบนจอ)'
  $bot = (Tg $tok 'getMe').result
  Say "  ✔ บอท @$($bot.username)" Green
  Tg $tok 'deleteWebhook' | Out-Null   # ให้ getUpdates ใช้ได้ชั่วคราว
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
  $from = $pick.from
  $admin = ''
  if ($from -and -not $from.is_bot) {
    $ans = Read-Host "  ให้ $($from.first_name) $($from.last_name) (tg:$($from.id)) เป็นผู้ดูแลคนแรก? [Y/n]"
    if ($ans -notmatch '^[nN]') { $admin = "tg:$($from.id)" }
  }
  if (-not $admin) { $admin = 'tg:' + (Read-Host '  ใส่ไอดี Telegram ของผู้ดูแล (ตัวเลขจาก @userinfobot)').Trim() }
  $short = Read-Host '  short name ของ Mini App ที่ตั้งใน /newapp (Enter = chat)'
  if (-not $short) { $short = 'chat' }
  $appLink = "https://t.me/$($bot.username)/$short"
  $pin = ReadSecret '  ตั้งรหัสทีมสำหรับเปิดจากเบราว์เซอร์ (Enter = ไม่เปิดให้ใช้นอก Telegram)'
  $whSecret = -join ((1..40) | ForEach-Object { '{0:x}' -f (Get-Random -Maximum 16) })
  $lines = @("TELEGRAM_BOT_TOKEN=$tok", "TELEGRAM_CHAT_ID=$chatId", "TELEGRAM_WEBHOOK_SECRET=$whSecret", "TELEGRAM_APP_LINK=$appLink", "ADMIN_IDS=$admin")
  if ($pin) { $lines += "TEAM_PIN=$pin" }
  [IO.File]::WriteAllLines($envFile, $lines)

  # ── 3. Google Drive ──
  Say "`n[3/6] Google Drive"
  & py -I tools\get_google_token.py --env $envFile --folder-url $urlFile
  if ($LASTEXITCODE) { throw 'ขั้น Google Drive ไม่สำเร็จ' }
  $folderUrl = (Get-Content $urlFile -Raw).Trim()

  # ── 4. Secrets ──
  Say "`n[4/6] ส่งค่าลับเข้า Supabase Secrets"
  Cli secrets set --env-file $envFile "--remote=$P" --yes
  Remove-Item $envFile -ErrorAction SilentlyContinue
  Say "  ✔ ใส่ค่าลับแล้ว (ไฟล์ชั่วคราวลบแล้ว)" Green

  # ── 5. Edge Function ──
  Say "`n[5/6] อัป Edge Function teamchat"
  Cli functions deploy teamchat --no-verify-jwt --use-api "--remote=$P" --yes
  Say "  ✔ อัปแล้ว" Green

  # ── 6. Webhook + ทดสอบ ──
  Say "`n[6/6] ต่อข้อความกลุ่ม Telegram เข้าแอป"
  $wh = Tg $tok 'setWebhook' @{ url = "$FN/tg-webhook"; secret_token = $whSecret; allowed_updates = @('message') }
  if (-not $wh.ok) { throw 'setWebhook ไม่สำเร็จ' }
  Say "  ✔ webhook ตั้งแล้ว" Green
  try { Invoke-RestMethod -Method Post -Uri "$FN/op/hello" -Body '{}' -ContentType 'application/json' | Out-Null }
  catch { if ($_.Exception.Response.StatusCode.value__ -eq 401) { Say '  ✔ Edge Function ตอบแล้ว (401 = ตรวจสิทธิ์ทำงาน)' Green } else { Say "  ⚠ Edge Function: $($_.Exception.Message)" Yellow } }

  # ลิงก์โฟลเดอร์ (ไม่ลับ) → config.js ให้ Claude push
  if ($folderUrl) {
    $cfg = Join-Path $root 'web\config.js'
    $txt = [IO.File]::ReadAllText($cfg)
    $txt = $txt -replace "driveRootUrl: '[^']*'", "driveRootUrl: '$folderUrl'"
    [IO.File]::WriteAllText($cfg, $txt, (New-Object Text.UTF8Encoding $false))
  }
  Tg $tok 'sendMessage' @{ chat_id = $chatId; text = "✅ Team Chat พร้อมใช้งาน`nเปิดแอป: $appLink" } | Out-Null

  Say "`n════════ เสร็จแล้ว ════════" Green
  Write-Host "  แอปใน Telegram : $appLink"
  Write-Host "  โฟลเดอร์ Drive  : $folderUrl"
  Write-Host "  (ถ้ายังไม่ได้ /newapp ใน @BotFather ให้ทำ แล้วใส่ URL หน้าเว็บ Cloudflare)"
  Write-Host "`n  บอก Claude ว่า 'ติดตั้งเสร็จแล้ว' ได้เลย (ไม่ต้องส่งค่าลับ)"
}
catch {
  Say "`n*** ไม่สำเร็จ: $($_.Exception.Message)" Red
  Say '    ถ่ายภาพหน้าจอนี้ส่งให้ Claude (ไม่มีค่าลับแสดงบนจอ)' Yellow
}
finally {
  Remove-Item $envFile, $urlFile -ErrorAction SilentlyContinue
}
Read-Host "`nกด Enter เพื่อปิด"
