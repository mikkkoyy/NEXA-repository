import sys

path = r'tests\creator.test.js'
src = open(path, 'r', encoding='utf-8').read()

out = []  # (line, char) outside strings/comments
i = 0
n = len(src)
mode_char = None
line = 1
while i < n:
    c = src[i]
    if c == '\n':
        line += 1
    if mode_char:
        if mode_char == 'line':
            if c == '\n':
                mode_char = None
        elif c == mode_char:
            if src[i+1:i+2] == mode_char:
                i += 2
                continue
            mode_char = None
        elif c == '\\':
            i += 2
            continue
        i += 1
        continue
    if c == '/' and src[i+1:i+2] == '/':
        mode_char = 'line'
        i += 2
        continue
    if c == '/' and src[i+1:i+2] == '*':
        mode_char = 'block'
        i += 2
        continue
    if c in ('"', "'", '`'):
        mode_char = c
        i += 1
        continue
    out.append((line, c))
    i += 1

tmp = []
matches = {')': '(', '}': '{', ']': '['}
ok = True
for ln, ch in out:
    if ch in '({[':
        tmp.append((ln, ch))
    elif ch in ')}]':
        if tmp and tmp[-1][1] == matches[ch]:
            tmp.pop()
        else:
            print('MISMATCH closing %s at line %s (top: %s)' % (ch, ln, tmp[-1] if tmp else None))
            ok = False

if tmp:
    ok = False
    for ln, ch in tmp:
        print('UNCLOSED %s at line %s' % (ch, ln))

print('BALANCED' if ok else 'IMBALANCED')
i = 0
n = len(src)
mode_char = None
line = 1
while i < n:
    c = src[i]
    if c == '\n':
        line += 1
    if mode_char:
        if mode_char == 'line':
            if c == '\n':
                mode_char = None
        elif c == mode_char:
            if src[i+1:i+2] == mode_char:
                i += 2
                continue
            mode_char = None
        elif c == '\\':
            i += 2
            continue
        i += 1
        continue
    if c == '/' and src[i+1:i+2] == '/':
        mode_char = 'line'
        i += 2
        continue
    if c == '/' and src[i+1:i+2] == '*':
        mode_char = 'block'
        i += 2
        continue
    if c in ('"', "'", '`'):
        mode_char = c
        i += 1
        continue
    out.append((line, c))
    i += 1

tmp = []  # stack of (line, char)
matches = {')': '(', '}': '{', ']': '['}
labels = {')': 'paren', ']': 'bracket', '}': 'brace'}
for ln, ch in out:
    if ch in '({[':
        tmp.append((ln, ch))
    elif ch in ')}]':
        if tmp and tmp[-1][1] == matches[ch]:
            top = tmp.pop()
            print('%-6s L%-4s closes L%-4s %s' % (ch, ln, top[0], matches[ch]))
        else:
            print('%-6s L%-4s MISMATCH (top: %s)' % (ch, ln, tmp[-1] if tmp else None))
print()
print('=== unclosed opens remaining on stack ===')
for ln, ch in tmp:
    print('  L%-4s %s' % (ln, ch))
print('count:', len(tmp))