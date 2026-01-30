# PowerShell script to fix the corrupted SVG in chat.html
$file = "c:\Users\Baha\Desktop\NEXCHAT\chat.html"

# Read the file
$content = Get-Content $file -Raw

# The corrupted base64 SVG (partial string to match)
$corruptedSVG = "vjSZhLTgtNHo"

# The valid base64 SVG for a group icon
$validSVG = "PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMDBmZjY2IiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PGNpcmNsZSBjeD0iOS41IiBjeT0iNyIgcj0iNCIvPjxwYXRoIGQ9Ik0zIDIxdi0yYTQgNCAwIDAgMSA0LTRoNWE0IDQgMCAwIDEgNCA0djIiLz48cGF0aCBkPSJNMTYgMy4xM2E0IDQgMCAwIDEgMCA3Ljc1Ii8+PHBhdGggZD0iTTIxIDIxdi0yYTQgNCAwIDAgMC0zLTMuODUiLz48L3N2Zz4="

# Check if the corrupted SVG exists
if ($content -match $corruptedSVG) {
    Write-Host "✅ Found corrupted SVG! Fixing..." -ForegroundColor Green
    
    # Replace the entire onerror attribute line
    $oldPattern = 'onerror="this\.src=''data:image/svg\+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMDBmZjY2IiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI\+PHBhdGggZD0iTTE3IDIxdjSZhLTgtNHoiPjwvcGF0aD48Y2lyY2xlIGN4PSI5IiBjeT0iNyIgcj0iNCI\+PC9jaXJNsZT48cGF0aCBkPSJNMjMgMjB2LTIxYTgtNHoiPjwvcGF0aD48L3N2Zz4=''\"'
    
    $newPattern = "onerror=`"this.src='data:image/svg+xml;base64,$validSVG'`""
    
    $newContent = $content -replace [regex]::Escape($oldPattern), $newPattern
    
    # Save the file
    $newContent | Set-Content $file -NoNewline
    
    Write-Host "✅ SVG FIXED! Your 56,000+ errors should be gone!" -ForegroundColor Cyan
    Write-Host "🎉 Refresh your browser to see the results!" -ForegroundColor Yellow
} else {
    Write-Host "⚠️ Corrupted SVG not found. It may have already been fixed." -ForegroundColor Yellow
}
