const { execSync } = require('child_process');
const fs = require('fs');
const dir = 'D:/FILES/project/NEXA_nodejs';
const bot = fs.readFileSync(dir + '/src/bot/bot.js', 'utf8');

console.log('HEAD commit:', execSync('git rev-parse HEAD', {cwd: dir, encoding:'utf8'}).trim());
console.log('origin/main:', execSync('git rev-parse origin/main', {cwd: dir, encoding:'utf8'}).trim());
console.log('newest.download present:', bot.includes('newest.download()'));
console.log('fetch(newest.url) present:', bot.includes('await fetch(newest.url)'));
console.log('Buffer.from present:', bot.includes('Buffer.from(await response.arrayBuffer())'));
console.log('oldDb present:', bot.includes('const oldDb = database.db'));
console.log('NOT uploading fresh DB:', bot.includes('NOT uploading a fresh database'));
console.log('client.once clientReady:', bot.includes("client.once('clientReady'"));
console.log('client.on ready:', bot.includes("client.on('ready'"));

console.log('\nFull git log:');
console.log(execSync('git log --oneline -10', {cwd: dir, encoding:'utf8'}).trim());

console.log('\ntriangular-radius branch:');
try { console.log(execSync('git log -1 --oneline triangular-radius', {cwd: dir, encoding:'utf8'}).trim()); } catch(e) { console.log('Error:', e.message.substring(0, 100)); }

console.log('\nHEAD~1 (f54f72e):');
try { console.log(execSync('git log -1 --oneline f54f72e', {cwd: dir, encoding:'utf8'}).trim()); } catch(e) { console.log('Error:', e.message.substring(0, 100)); }

console.log('\nHEAD commit message:');
try { console.log(execSync('git log -1 --format="%s" HEAD', {cwd: dir, encoding:'utf8'}).trim()); } catch(e) { console.log('Error:', e.message.substring(0, 100)); }

console.log('\nHEAD~1 (f54f72e) commit message:');
try { console.log(execSync('git log -1 --format="%s" f54f72e', {cwd: dir, encoding:'utf8'}).trim()); } catch(e) { console.log('Error:', e.message.substring(0, 100)); }
