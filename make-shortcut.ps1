# Team Chat - สร้าง shortcut บน Desktop (+ OneDrive\Desktop ถ้ามี) พร้อมไอคอน (โดย ลุงพี)
#   powershell -ExecutionPolicy Bypass -File make-shortcut.ps1     · รันซ้ำได้ ทั้ง laptop/home
#   "Team Chat"           → เปิดเว็บจริง https://teamchat-eih.pages.dev ในเบราว์เซอร์หลัก
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$icon = Join-Path $root 'teamchat.ico'
$url = 'https://teamchat-eih.pages.dev'
if (-not (Test-Path $icon)) { throw "ไม่พบไอคอน $icon (รัน py tools\make_icon.py ก่อน)" }
$desks = @([Environment]::GetFolderPath('Desktop'))
if ($env:OneDrive) { $od = Join-Path $env:OneDrive 'Desktop'; if (Test-Path $od) { $desks += $od } }
$ws = New-Object -ComObject WScript.Shell
foreach ($d in ($desks | Select-Object -Unique)) {
  $s = $ws.CreateShortcut((Join-Path $d 'Team Chat.lnk'))
  $s.TargetPath = Join-Path $env:SystemRoot 'explorer.exe'
  $s.Arguments = $url
  $s.IconLocation = "$icon,0"
  $s.Description = 'Team Chat - แชททีม ProInventive (เว็บจริง)'
  $s.Save()
  Write-Output "สร้าง shortcut: $(Join-Path $d 'Team Chat.lnk') → $url"
}
