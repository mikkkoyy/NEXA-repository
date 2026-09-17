const fs = require('fs');
const { execSync } = require('child_process');
const dir = 'D:/FILES/project/NEXA_nodejs';

// Verify source
const bot = fs.readFileSync(dir + '/src/bot/bot.js', 'utf8');
console.log('=== FINAL SOURCE VERIFICATION ===');
console.log('newest.download():', bot.includes('newest.download()'));
console.log('await fetch(newest.url):', bot.includes('await fetch(newest.url)'));
console.log('Buffer.from(await response.arrayBuffer()):', bot.includes('Buffer.from(await response.arrayBuffer())'));
console.log('oldDb preservation:', bot.includes('const oldDb = database.db'));
console.log('{ found, restored } return:', bot.includes('return { found, restored }'));
console.log('startBackupTimer(restored):', bot.includes('startBackupTimer(restored)'));
console.log('client.once clientReady:', bot.includes("client.once('clientReady'"));
console.log('client.on ready:', bot.includes("client.on('ready'"));
console.log('NOT uploading fresh DB:', bot.includes('NOT uploading a fresh database'));

// Run tests
console.log('\n=== RUNNING TESTS ===');
const result = execSync('npm test 2>&1', {cwd: dir, encoding:'utf8', timeout: 60000});
const passMatch = result.match(/tests\s+(\d+)/);
const failMatch = result.match(/fail\s+(\d+)/);
console.log(passMatch ? `Tests: ${passMatch[1]}` : '');
console.log(failMatch ? `Failures: ${failMatch[1]}` : '');
console.log(result.includes('fail 0') ? 'ALL TESTS PASS' : 'SOME TESTS FAILED');

// Final git status
console.log('\n=== FINAL GIT STATUS ===');
console.log('HEAD:', execSync('git rev-parse HEAD', {cwd: dir, encoding:'utf8'}).trim());
console.log('origin/main:', execSync('git rev-parse origin/main', {cwd: dir, encoding:'utf8'}).trim());
console.log('Branch:', execSync('git branch --show-current', {cwd: dir, encoding:'utf8'}).trim());
console.log('git status:', execSync('git status --short', {cwd: dir, encoding:'utf8'}).trim() || 'clean');
console.log('Remote:', execSync('git remote get-url origin', {cwd: dir, encoding:'utf8'}).trim());
