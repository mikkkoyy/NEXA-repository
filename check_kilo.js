const fs = require('fs');
const { execSync } = require('child_process');
const dir = 'D:/FILES/project/NEXA_nodejs';

// Check .kilo directory
console.log('=== .kilo contents ===');
try {
    const entries = fs.readdirSync(dir + '/.kilo');
    console.log(entries);
    try {
        const wt = fs.readdirSync(dir + '/.kilo/worktrees');
        console.log('worktrees:', wt);
    } catch(e) { console.log('No worktrees dir'); }
} catch(e) { console.log('.kilo not found'); }

// Check commit_nexa.bat
console.log('\n=== commit_nexa.bat ===');
try {
    const content = fs.readFileSync(dir + '/commit_nexa.bat', 'utf8');
    console.log(content);
} catch(e) { console.log('Error:', e.message.substring(0, 100)); }

// Check .kilo structure
console.log('\n=== .kilo recursive ===');
function listDir(path, depth) {
    if (depth > 3) return;
    try {
        const entries = fs.readdirSync(path, {withFileTypes: true});
        for (const e of entries) {
            const full = path + '/' + e.name;
            console.log('  '.repeat(depth) + e.name + (e.isDirectory() ? '/' : ''));
            if (e.isDirectory()) listDir(full, depth+1);
        }
    } catch(e) {}
}
listDir(dir + '/.kilo', 0);

// Clean up .git_test
try { execSync('rmdir /s /q "' + dir + '/.git_test"', {encoding:'utf8', timeout: 5000}); } catch(e) { console.log('Cannot remove .git_test'); }
