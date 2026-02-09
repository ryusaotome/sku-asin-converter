$name = "SKU" + [char]0x304B + [char]0x3089 + "ASIN" + [char]0x62BD + [char]0x51FA
$folder = "SKU" + [char]0x304B + [char]0x3089 + "ASIN" + [char]0x62BD + [char]0x51FA
$ws = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktop ($name + ".lnk")
$shortcut = $ws.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "c:\Users\loudh\Desktop\Antigravity\$folder\run_app.bat"
$shortcut.WorkingDirectory = "c:\Users\loudh\Desktop\Antigravity\$folder"
$shortcut.Save()
