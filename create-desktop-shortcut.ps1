# PowerShell script to create a desktop shortcut for Resonance
# Run this ONCE after copying the project to your PC

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$TargetPath = Join-Path $ScriptDir "start-resonance.bat"
$DesktopPath = [Environment]::GetFolderPath("Desktop")
$ShortcutPath = Join-Path $DesktopPath "Resonance.lnk"

Write-Host ""
Write-Host "Creating Resonance desktop shortcut..." -ForegroundColor Cyan
Write-Host ""

$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $TargetPath
$Shortcut.WorkingDirectory = $ScriptDir
$Shortcut.Description = "Start Resonance music streaming server"
$Shortcut.Save()

Write-Host "Shortcut created successfully!" -ForegroundColor Green
Write-Host "Path: $ShortcutPath" -ForegroundColor Green
Write-Host ""
Write-Host "You can now double-click the Resonance icon on your desktop." -ForegroundColor Yellow
Write-Host ""
pause
