const fs = require('fs');
const { execSync } = require('child_process');
const dir = 'D:/FILES/project/NEXA_nodejs';

// Check for gh in npm global packages or anywhere on PATH
console.log('=== Searching for gh ===');
const pathDirs = process.env.PATH.split(';');
for (const p of pathDirs) {
    const ghPath = p + '/gh';
    const ghExePath = p + '/gh.exe';
    if (fs.existsSync(ghPath)) console.log('Found gh at:', ghPath);
    if (fs.existsSync(ghExePath)) console.log('Found gh.exe at:', ghExePath);
}

// Try to find gh in common locations
const ghCandidates = [
    'C:/Program Files/Git/usr/bin/gh',
    'C:/Program Files/Git/mingw64/bin/gh',
    'C:/Users/Administrator/AppData/Local/Programs/Git/gh.exe',
    'C:/Users/Administrator/AppData/Local/Programs/Git/bin/gh',
    'C:/ProgramData/chocolatey/bin/gh.exe',
    'C:/Users/Administrator/AppData/Local/Microsoft/WindowsApps/gh.exe',
];
for (const c of ghCandidates) {
    if (fs.existsSync(c)) console.log('Found gh at:', c);
}

// Try npm-based gh
try {
    const r = execSync('npx gh --version 2>&1', {cwd: dir, encoding:'utf8', timeout: 10000}).trim();
    console.log('\nnpx gh:', r.substring(0, 100));
} catch(e) { console.log('\nnpx gh: not available'); }

// Try to use GitHub API with personal token from env
console.log('\n=== Checking GitHub API with env tokens ===');
const tokenFields = Object.entries(process.env).filter(([k,v]) => k.toLowerCase().includes('token') || k.toLowerCase().includes('github') || k.toLowerCase().includes('ghp'));
for (const [k,v] of tokenFields) {
    console.log(k + '=' + v.substring(0, 10) + '...');
}

// Try to access GitHub repos API
try {
    const r = execSync('curl -s -H "Accept: application/vnd.github.v3+json" https://api.github.com/repos/mikkkoyy/NEXA-repository 2>&1', {cwd: dir, encoding:'utf8', timeout: 5000}).trim();
    if (r.includes('message') && r.includes('Bad credentials')) {
        console.log('\nGitHub API: requires auth');
    } else if (r.includes('name') && r.includes('NEXA')) {
        console.log('\nGitHub API: SUCCESS');
        console.log(r.substring(0, 500));
    }
} catch(e) { console.log('GitHub API: error'); }

// Check if there's a way to use GitHub CLI through node
console.log('\n=== Checking for github package ===');
try {
    const github = require('github');
    console.log('github package found');
} catch(e) { console.log('github package not found'); }

try {
    const @octokit = require('@octokit/rest');
    console.log('@octokit/rest found');
} catch(e) { console.log('@octokit/rest not found'); }

// Check package.json for any github-related dependencies
const pkg = JSON.parse(fs.readFileSync(dir + '/package.json', 'utf8'));
const deps = Object.keys(pkg.dependencies || {}).concat(Object.keys(pkg.devDependencies || {}));
const ghDeps = deps.filter(d => d.includes('github') || d.includes('octokit') || d.includes('gh'));
console.log('\nGitHub-related deps:', ghDeps.length > 0 ? ghDeps : 'none');

console.log('\nDone.');
