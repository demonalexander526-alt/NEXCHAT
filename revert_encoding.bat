@echo off
powershell -Command "$s = Get-Content -Path 'c:\Users\Baha\Desktop\NEXCHAT\chat.js' -Raw; $b = [System.Text.Encoding]::Unicode.GetBytes($s); [System.IO.File]::WriteAllBytes('c:\Users\Baha\Desktop\NEXCHAT\chat.js', $b)"
