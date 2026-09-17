const fs = require('fs');
const dir = 'D:/FILES/project/NEXA_nodejs';

// Read agent-manager.json
console.log('=== agent-manager.json ===');
try {
    const content = fs.readFileSync(dir + '/.kilo/agent-manager.json', 'utf8');
    console.log(content);
} catch(e) { console.log('Error:', e.message); }

// Read .kilo/.gitignore
console.log('\n=== .kilo/.gitignore ===');
try {
    console.log(fs.readFileSync(dir + '/.kilo/.gitignore', 'utf8').substring(0, 500));
} catch(e) {}

// Check if horn-structure .git is a real repo
console.log('\n=== horn-structure .git check ===');
const hsDir = dir + '/.kilo/worktrees/horn-structure';
try {
    const r = require('child_process').execSync('git rev-parse HEAD', {cwd: hsDir, encoding:'utf8'}).trim();
    console.log('HEAD:', r);
    const r2 = require('child_process').execSync('git remote -v', {cwd: hsDir, encoding:'utf8'}).trim();
    console.log('Remotes:', r2);
    const r3 = require('child_process').execSync('git branch --show-current', {cwd: hsDir, encoding:'utf8'}).trim();
    console.log('Branch:', r3);
} catch(e) { console.log('Error:', e.message.substring(0, 100)); }

// Check .kilo worktrees .git
console.log('\n=== .kilo/worktrees/.git ===');
try {
    const entries = fs.readdirSync(dir + '/.kilo/worktrees', {withFileTypes: true});
    console.log('Entries:', entries.map(e => e.name + (e.isDirectory() ? '/' : '')));
    try {
        const gitEntries = fs.readdirSync(dir + '/.kilo/worktrees/.git', {withFileTypes: true});
        console.log('.git contents:', gitEntries.slice(0, 10));
    } catch(e) { console.log('No .git dir in worktrees'); }
} catch(e) {}

// Check if there are any Wispbyte config files in .kilo
console.log('\n=== Searching .kilo for Wispbyte config ===');
function searchDir(p, depth) {
    if (depth > 2) return;
    try {
        const entries = fs.readdirSync(p, {withFileTypes: true});
        for (const e of entries) {
            const full = p + '/' + e.name;
            if (e.name.toLowerCase().includes('wisp') || e.name.toLowerCase().includes('deploy') || e.name.toLowerCase().includes('config') || e.name === 'settings.json' || e.name === 'config.json') {
                console.log('Found:', full);
                if (e.isFile() && (e.name.endsWith('.json') || e.name.endsWith('.yaml') || e.name.endsWith('.yml') || e.name.endsWith('.toml'))) {
                    try { console.log(fs.readFileSync(full, 'utf8').substring(0, 500)); } catch(e) {}
                }
            }
            if (e.isDirectory()) searchDir(full, depth+1);
        }
    } catch(e) {}
}
searchDir(dir + '/.kilo', 0);
