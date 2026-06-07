# PowerShell script to create a desktop shortcut for Resonance
# Run this ONCE after copying the project to your PC

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$TargetPath = Join-Path $ScriptDir "start-resonance.bat"
$DesktopPath = [Environment]::GetFolderPath("Desktop")
$ShortcutPath = Join-Path $DesktopPath "Resonance.lnk"

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║    Creating Resonance desktop shortcut...       ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $TargetPath
$Shortcut.WorkingDirectory = $ScriptDir
$Shortcut.Description = "Start Resonance music streaming server"
# Optional: set a custom icon (use a .ico file if you have one)
# $Shortcut.IconLocation = "C:\Path\To\Icon.ico"
$Shortcut.Save()

Write-Host "✅ Shortcut created: $ShortcutPath" -ForegroundColor Green
Write-Host ""
Write-Host "You can now double-click 'Resonance' on your desktop to start the server!" -ForegroundColor Yellow
Write-Host ""
pause
