
const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\Baha\\Desktop\\NEXCHAT\\chat.js', 'utf8');

let stack = [];
let lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    for (let j = 0; j < line.length; j++) {
        let char = line[j];
        if (char === '{') {
            stack.push({ line: i + 1, char: j + 1 });
        } else if (char === '}') {
            if (stack.length === 0) {
                console.log(`Extra '}' at line ${i + 1}, column ${j + 1}`);
            } else {
                stack.pop();
            }
        }
    }
}

if (stack.length > 0) {
    stack.forEach(unclosed => {
        console.log(`Unclosed '{' at line ${unclosed.line}, column ${unclosed.char}`);
    });
} else {
    console.log("Braces are balanced (simple check)");
}
