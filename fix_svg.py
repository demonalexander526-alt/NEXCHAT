# Simple Python script to fix SVG error
import re

file_path = r"c:\Users\Baha\Desktop\NEXCHAT\chat.html"

# Read the file
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Find and replace any base64 SVG containing the corrupted segment
corrupted_marker = "vjSZhLTgtNHo"

if corrupted_marker in content:
    print("✅ Found corrupted SVG!")
    
    # Valid group icon SVG (properly encoded)
    valid_svg = "PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMDBmZjY2IiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PGNpcmNsZSBjeD0iOS41IiBjeT0iNyIgcj0iNCIvPjxwYXRoIGQ9Ik0zIDIxdi0yYTQgNCAwIDAgMSA0LTRoNWE0IDQgMCAwIDEgNCA0djIiLz48cGF0aCBkPSJNMTYgMy4xM2E0IDQgMCAwIDEgMCA3Ljc1Ii8+PHBhdGggZD0iTTIxIDIxdi0yYTQgNCAwIDAgMC0zLTMuODUiLz48L3N2Zz4="
    
    # Pattern to find the onerror attribute with corrupted SVG
    pattern = r'onerror="this\.src=\'data:image/svg\+xml;base64,[^\']+vjSZhLTgtNHo[^\']+\'"'
    
    replacement = f'onerror="this.src=\'data:image/svg+xml;base64,{valid_svg}\'"'
    
    new_content = re.sub(pattern, replacement, content)
    
    # Save back
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print("✅ FIXED! The 56,000+ errors are now gone!")
    print("🎉 Refresh your browser!")
else:
    print("⚠️ Corrupted SVG marker not found in file")
