$ws = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop "SKUからASIN抽出.lnk"
$shortcut = $ws.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "c:\Users\loudh\Desktop\Antigravity\SKUからASIN抽出\run_app.bat"
$shortcut.WorkingDirectory = "c:\Users\loudh\Desktop\Antigravity\SKUからASIN抽出"
$shortcut.Save()
