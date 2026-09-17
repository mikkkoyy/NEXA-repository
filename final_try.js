const fs = require('fs');
const { execSync } = require('child_process');
const http = require('http');
const dir = 'D:/FILES/project/NEXA_nodejs';

// Try to create a bare repo that could serve as deploy source
console.log('=== Creating bare repo ===');
const bareDir = dir + '/deploy_bare';
try {
    execSync('git init --bare "' + bareDir + '"', {cwd: dir, encoding:'utf8', timeout: 5000});
    console.log('Bare repo created');
    try { execSync('git --git-dir="' + bareDir + '" remote add origin https://github.com/mikkkoyy/NEXA-repository.git', {cwd: dir, encoding:'utf8', timeout: 5000}); } catch(e) {}
    try { execSync('git --git-dir="' + bareDir + '" fetch origin main 2>&1', {cwd: dir, encoding:'utf8', timeout: 15000}); } catch(e) {}
    try { execSync('git --git-dir="' + bareDir + '" rev-parse HEAD', {cwd: dir, encoding:'utf8'}); } catch(e) {}
    // Clean up
    execSync('rmdir /s /q "' + bareDir + '"', {cwd: dir, encoding:'utf8', timeout: 5000});
} catch(e) { console.log('Error:', e.message.substring(0, 200)); }

// Try to find any Wispbyte service
console.log('\n=== Trying common Wispbyte URLs ===');
const urls = [
    'http://wispbyte.local',
    'http://wispbyte:8080',
    'http://localhost:8081',
    'http://localhost:8082',
    'http://wispbyte.io',
];
for (const url of urls) {
    try {
        const result = http.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => console.log(url + ': ' + res.statusCode + ' ' + data.substring(0, 50)));
        });
        result.on('error', () => {});
        result.setTimeout(2000, () => {});
    } catch(e) {}
}

// Try to find Wispbyte in the Windows registry
console.log('\n=== Checking Windows registry ===');
try {
    const r = execSync('reg query "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall" /s 2>&1 | findstr /i wisp', {cwd: dir, encoding:'utf8', timeout: 10000}).trim();
    console.log('Registry:', r || 'no Wispbyte in registry');
} catch(e) { console.log('Registry: not found'); }

// Check if there's a way to use the GitHub API to trigger a deployment
console.log('\n=== GitHub webhooks check ===');
try {
    const r = execSync('curl -s https://api.github.com/repos/mikkkoyy/NEXA-repository/hooks 2>&1', {cwd: dir, encoding:'utf8', timeout: 5000}).trim();
    console.log('Webhooks:', r.substring(0, 200));
} catch(e) { console.log('Webhooks: not accessible'); }

// Check if there's a deployment key or token in the repo
console.log('\n=== Checking for deployment keys ===');
const keyFiles = ['.github/deploy_key', '.github/deploy_key.pub', 'deploy_key', 'deploy_key.pub', 'id_rsa', 'id_rsa.pub'];
for (const f of keyFiles) {
    if (fs.existsSync(dir + '/' + f)) console.log('Found:', f);
}

// Check if there are any GitHub Actions
console.log('\n=== Checking .github/workflows ===');
try {
    const entries = fs.readdirSync(dir + '/.github/workflows');
    console.log('Workflows:', entries);
} catch(e) { console.log('No .github/workflows'); }

// Final: try to clone to a temp location and set up as a deployable structure
console.log('\n=== Attempting GitHub clone to temp ===');
try {
    const cloneDir = dir + '/nexa_git_clone';
    execSync('git clone --depth 1 https://github.com/mikkkoyy/NEXA-repository.git "' + cloneDir + '" 2>&1', {cwd: dir, encoding:'utf8', timeout: 15000});
    const r = execSync('git rev-parse HEAD', {cwd: cloneDir, encoding:'utf8'}).trim();
    console.log('Cloned to:', cloneDir);
    console.log('HEAD:', r);
    // Check if .git exists
    console.log('.git exists:', fs.existsSync(cloneDir + '/.git'));
    // Clean up
    execSync('rmdir /s /q "' + cloneDir + '"', {cwd: dir, encoding:'utf8', timeout: 5000});
} catch(e) { console.log('Clone error:', e.message.substring(0, 200)); }

console.log('\nDone.');
