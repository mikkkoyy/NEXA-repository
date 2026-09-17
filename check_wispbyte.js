const fs = require('fs');
const { execSync } = require('child_process');
const os = require('os');

const dir = 'D:/FILES/project/NEXA_nodejs';

console.log('=== Checking git clone access ===');
try {
    const r = execSync('git clone --depth 1 https://github.com/mikkkoyy/NEXA-repository.git /tmp/nexa_clone_test 2>&1', {cwd: dir, encoding:'utf8', timeout: 30000}).trim();
    console.log('Clone succeeded');
    try { execSync('rm -rf /tmp/nexa_clone_test', {cwd: dir, timeout: 5000}); } catch(e) {}
} catch(e) { console.log('Clone error:', e.message.substring(0, 200)); }

console.log('\n=== Checking Wispbyte paths ===');
const paths = [
    os.homedir() + '/.wispbyte',
    os.homedir() + '/wispbyte.json',
    os.homedir() + '/.config/wispbyte',
    'C:/ProgramData/wispbyte',
    'C:/wispbyte',
    'C:/Users/Administrator/.wispbyte',
    '/home/container'
];
for (const p of paths) {
    if (fs.existsSync(p)) {
        console.log(p + ': EXISTS');
        try { const entries = fs.readdirSync(p); console.log('  contents:', entries.slice(0, 10)); } catch(e) { console.log('  read error'); }
    } else {
        console.log(p + ': NOT FOUND');
    }
}

console.log('\n=== Checking package.json for Wispbyte config ===');
const pkg = JSON.parse(fs.readFileSync(dir + '/package.json', 'utf8'));
console.log('scripts:', JSON.stringify(pkg.scripts));
console.log('main:', pkg.main);

console.log('\n=== Checking for any Wispbyte-related files ===');
const candidates = ['.wispbyte', 'wispbyte.json', 'wispbyte.config', 'deploy.config', 'render.yaml', 'Dockerfile', 'docker-compose.yml', '.github', '.github/workflows', 'cloud.yaml', '.do', 'fly.toml', 'vercel.json', 'netlify.toml'];
for (const c of candidates) {
    const full = dir + '/' + c;
    if (fs.existsSync(full)) {
        console.log(c + ': EXISTS');
        try { console.log('  ' + fs.readFileSync(full, 'utf8').substring(0, 200)); } catch(e) {}
    }
}

console.log('\n=== Checking git remotes ===');
try { console.log(execSync('git remote -v', {cwd: dir, encoding:'utf8'}).trim()); } catch(e) {}
try { console.log('HEAD: ' + execSync('git rev-parse HEAD', {cwd: dir, encoding:'utf8'}).trim()); } catch(e) {}
try { console.log('origin/main: ' + execSync('git rev-parse origin/main', {cwd: dir, encoding:'utf8'}).trim()); } catch(e) {}
