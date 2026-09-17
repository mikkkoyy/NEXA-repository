const fs = require('fs');
const { execSync } = require('child_process');
const dir = 'D:/FILES/project/NEXA_nodejs';

// Check if the horn-structure .git is a real bare repo or a standard repo
const hsGit = dir + '/.kilo/worktrees/horn-structure/.git';
console.log('=== horn-structure/.git check ===');
try {
    const entries = fs.readdirSync(hsGit);
    console.log('Entries:', entries.slice(0, 15));
    console.log('Has HEAD:', fs.existsSync(hsGit + '/HEAD'));
    console.log('Has config:', fs.existsSync(hsGit + '/config'));
    console.log('Has objects:', fs.existsSync(hsGit + '/objects'));
    console.log('Has refs:', fs.existsSync(hsGit + '/refs'));
    
    // Read config
    try {
        console.log('\nGit config:');
        console.log(fs.readFileSync(hsGit + '/config', 'utf8').substring(0, 500));
    } catch(e) {}
    
    // Read HEAD
    try {
        console.log('\nHEAD:', fs.readFileSync(hsGit + '/HEAD', 'utf8').trim());
    } catch(e) {}
} catch(e) { console.log('Error:', e.message); }

// Check if horn-structure has the fix
console.log('\n=== horn-structure source check ===');
const hsBot = dir + '/.kilo/worktrees/horn-structure/src/bot/bot.js';
try {
    const bot = fs.readFileSync(hsBot, 'utf8');
    console.log('newest.download():', bot.includes('newest.download()'));
    console.log('await fetch(newest.url):', bot.includes('await fetch(newest.url)'));
    console.log('Commit:', execSync('git rev-parse HEAD', {cwd: dir + '/.kilo/worktrees/horn-structure', encoding:'utf8'}).trim());
} catch(e) { console.log('Error:', e.message.substring(0, 100)); }

// Check if we can use the horn-structure git repo as a template
console.log('\n=== Can we create a deployable .git? ===');
try {
    const hsGitDir = dir + '/.kilo/worktrees/horn-structure/.git';
    // Check if this is a full git repo
    const r = execSync(`git --git-dir="${hsGitDir}" rev-parse --is-bare-repository`, {cwd: dir, encoding:'utf8'}).trim();
    console.log('Is bare:', r);
    
    // Check if we can init a bare repo from the main repo
    const mainRepo = dir + '/.git';
    const r2 = execSync(`git --git-dir="${mainRepo}" rev-parse --is-bare-repository`, {cwd: dir, encoding:'utf8'}).trim();
    console.log('Main repo is bare:', r2);
    
    // Check if we can create a working tree clone
    console.log('\nMain repo HEAD:', execSync('git rev-parse HEAD', {cwd: dir, encoding:'utf8'}).trim());
} catch(e) { console.log('Error:', e.message.substring(0, 100)); }
