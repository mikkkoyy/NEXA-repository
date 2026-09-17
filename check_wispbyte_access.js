const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const net = require('net');

// Check for Wispbyte CLI
const cliCommands = ['wispbyte', 'wispbyte-cli', 'wisp', 'wispbyte-api'];
console.log('=== Wispbyte CLI check ===');
for (const cmd of cliCommands) {
    try {
        const r = execSync(`${cmd} --help 2>&1 || ${cmd} --version 2>&1`, {encoding:'utf8', timeout: 5000}).trim();
        console.log(cmd + ': FOUND');
        console.log('  ' + r.substring(0, 200));
    } catch(e) {
        console.log(cmd + ': not found');
    }
}

// Check if gh CLI exists
try {
    const r = execSync('gh --version 2>&1', {encoding:'utf8', timeout: 5000}).trim();
    console.log('\ngh CLI:', r.substring(0, 100));
} catch(e) { console.log('\ngh CLI: not found'); }

// Check for any running services on common ports
console.log('\n=== Port scan ===');
const ports = [8080, 3000, 5000, 8000, 8888, 9090, 3001, 80, 443];
for (const port of ports) {
    try {
        const server = net.createServer();
        server.listen(port, '127.0.0.1');
        server.close();
        console.log(`Port ${port}: available (no service)`);
    } catch(e) {
        console.log(`Port ${port}: SERVICE RUNNING`);
    }
}

// Check for any Wispbyte environment variables in the system
console.log('\n=== System env vars with "wisp" or "container" ===');
const env = Object.entries(process.env);
const matched = env.filter(([k,v]) => k.toLowerCase().includes('wisp') || k.toLowerCase().includes('container') || k.toLowerCase().includes('deploy') || k.toLowerCase().includes('repo'));
for (const [k,v] of matched) {
    console.log(`${k}=${v.substring(0, 50)}${v.length > 50 ? '...' : ''}`);
}

// Check for Wispbyte config in any JSON files
console.log('\n=== Searching for Wispbyte config ===');
const searchDirs = [os.homedir(), 'C:/ProgramData', 'C:/Users/Administrator'];
for (const searchDir of searchDirs) {
    try {
        const files = fs.readdirSync(searchDir);
        const wispFiles = files.filter(f => f.toLowerCase().includes('wisp') || f.toLowerCase().includes('deploy'));
        if (wispFiles.length > 0) {
            console.log(`Found in ${searchDir}:`, wispFiles);
        }
    } catch(e) {}
}

// Try to access Wispbyte web interface
console.log('\n=== Trying Wispbyte API ===');
const http = require('http');
const urls = ['http://localhost:8080/api', 'http://localhost:3000/api', 'http://localhost:5000/api'];
for (const url of urls) {
    try {
        const result = http.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => console.log(`${url}: ${res.statusCode} - ${data.substring(0, 100)}`));
        });
        result.on('error', () => {});
        result.setTimeout(2000, () => {});
    } catch(e) {}
}

console.log('\nDone.');
