# Team Chat - สร้าง shortcut บน Desktop (+ OneDrive\Desktop ถ้ามี) พร้อมไอคอน (โดย ลุงพี)
#   powershell -ExecutionPolicy Bypass -File make-shortcut.ps1     · รันซ้ำได้ ทั้ง laptop/home
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$target = Join-Path $root 'TeamChat.bat'
$icon = Join-Path $root 'teamchat.ico'
if (-not (Test-Path $icon)) { throw "ไม่พบไอคอน $icon (รัน py tools\make_icon.py ก่อน)" }
$desks = @([Environment]::GetFolderPath('Desktop'))
if ($env:OneDrive) { $od = Join-Path $env:OneDrive 'Desktop'; if (Test-Path $od) { $desks += $od } }
$ws = New-Object -ComObject WScript.Shell
foreach ($d in ($desks | Select-Object -Unique)) {
  $lnk = Join-Path $d 'Team Chat.lnk'
  $s = $ws.CreateShortcut($lnk)
  $s.TargetPath = $target
  $s.WorkingDirectory = $root
  $s.IconLocation = "$icon,0"
  $s.WindowStyle = 7
  $s.Description = 'Team Chat - แชททีม Telegram + Supabase + Google Drive (โดย ลุงพี)'
  $s.Save()
  Write-Output "สร้าง shortcut: $lnk"
}
