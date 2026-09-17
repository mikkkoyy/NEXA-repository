const fs = require('fs');
const path = 'D:/FILES/project/NEXA_nodejs';
const { execSync } = require('child_process');

// Check for deployment scripts/configs
const candidates = ['deploy.sh', 'deploy.js', 'start.sh', 'entrypoint.sh', 'wispbyte.sh', 'init.sh', '.wispbyte', 'wispbyte.config', 'wispbyte.json'];
console.log('=== Deployment configs ===');
for (const c of candidates) {
    const full = path + '/' + c;
    console.log(c + ':', fs.existsSync(full) ? 'EXISTS' : 'not found');
}

// Check package.json
const pkg = JSON.parse(fs.readFileSync(path + '/package.json', 'utf8'));
console.log('\npackage.json scripts:', JSON.stringify(pkg.scripts, null, 2));
console.log('main:', pkg.main);

// Check GitHub API and git access
console.log('\n=== GitHub access ===');
try {
    const r1 = execSync('curl -s -o /dev/null -w "%{http_code}" https://api.github.com/repos/mikkkoyy/NEXA-repository', {cwd: path, encoding:'utf8', timeout: 5000}).trim();
    console.log('GitHub API HTTP status:', r1);
} catch (e) { console.log('GitHub API: not accessible'); }

try {
    const r2 = execSync('git ls-remote origin HEAD', {cwd: path, encoding:'utf8', timeout: 10000}).trim();
    console.log('git ls-remote origin HEAD:', r2.substring(0, 20));
} catch (e) { console.log('git ls-remote: error -', e.message.substring(0, 100)); }

// Check if there's a way to set Wispbyte deployment config
console.log('\n=== Final verification ===');
const bot = fs.readFileSync(path + '/src/bot/bot.js', 'utf8');
console.log('newest.download present:', bot.includes('newest.download()'));
console.log('fetch(newest.url) present:', bot.includes('await fetch(newest.url)'));
console.log('better-sqlite3 Buffer test:');
const sqlite = require('better-sqlite3');
const tmpPath = path + '/_final_bs.db';
try {
    const db1 = new sqlite(tmpPath);
    db1.exec('CREATE TABLE t (x INT)');
    db1.exec('INSERT INTO t VALUES (99)');
    const buf = db1.serialize();
    db1.close();
    const db2 = new sqlite(buf);
    const r = db2.prepare('SELECT x FROM t').get();
    db2.close();
    console.log('  Buffer-based restore:', r.x === 99 ? 'WORKS' : 'FAILED');
} catch(e) { console.log('  Error:', e.message.substring(0, 100)); }
try { fs.unlinkSync(tmpPath); } catch(e) {}

console.log('\n=== Conclusion ===');
console.log('Local repo is correct at f54f72e');
console.log('/home/container is NOT accessible from local Windows');
console.log('Wispbyte is deploying uploaded files (GIT_REPO=NO)');
console.log('Need to configure Wispbyte to deploy from GitHub repository');
console.log('Repository: https://github.com/mikkkoyy/NEXA-repository.git');
console.log('Branch: main');
