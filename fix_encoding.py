import os

path = r'c:\Users\Baha\Desktop\NEXCHAT\chat.js'
try:
    with open(path, 'rb') as f:
        content = f.read()
    
    # Try to detect if it's UTF-16
    try:
        decoded = content.decode('utf-16')
        print("Detected UTF-16")
    except UnicodeDecodeError:
        try:
            decoded = content.decode('utf-8')
            print("Detected UTF-8")
        except UnicodeDecodeError:
            decoded = content.decode('latin-1')
            print("Detected Latin-1")

    with open(path, 'w', encoding='utf-8') as f:
        f.write(decoded)
    print("Successfully converted to UTF-8")
except Exception as e:
    print(f"Error: {e}")
