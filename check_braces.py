
import os

filepath = r'c:\Users\Baha\Desktop\NEXCHAT\chat.js'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

stack = []
for i, line in enumerate(content.split('\n'), 1):
    for j, char in enumerate(line, 1):
        if char == '{':
            stack.append((i, j))
        elif char == '}':
            if not stack:
                print(f"Extra '}}' at line {i}, column {j}")
            else:
                stack.pop()

for line, col in stack:
    print(f"Unclosed '{{' at line {line}, column {col}")

if not stack:
    print("Braces are balanced (simple check)")
