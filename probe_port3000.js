const http = require('http');

function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
        }).on('error', reject);
    });
}

async function main() {
    const urls = [
        'http://localhost:3000',
        'http://localhost:3000/api',
        'http://localhost:3000/api/status',
        'http://localhost:3000/api/config',
        'http://localhost:3000/api/deploy',
        'http://localhost:3000/api/settings',
        'http://localhost:3000/api/repo',
        'http://localhost:3000/api/repository',
        'http://localhost:3000/api/projects',
    ];
    
    for (const url of urls) {
        try {
            const r = await fetchUrl(url);
            console.log(`\n=== ${url} (${r.status}) ===`);
            const body = r.body.substring(0, 2000);
            console.log(body);
        } catch(e) {
            console.log(`\n${url}: ERROR - ${e.message.substring(0, 100)}`);
        }
    }
    
    // Also try POST requests for common API endpoints
    console.log('\n=== Trying POST requests ===');
    const postEndpoints = ['/api/deploy', '/api/repository', '/api/settings', '/api/config'];
    for (const ep of postEndpoints) {
        try {
            const data = JSON.stringify({ repo: 'https://github.com/mikkkoyy/NEXA-repository.git', branch: 'main' });
            const r = await new Promise((resolve, reject) => {
                const req = http.request(`http://localhost:3000${ep}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
                }, (res) => {
                    let body = '';
                    res.on('data', chunk => body += chunk);
                    res.on('end', () => resolve({ status: res.statusCode, body }));
                });
                req.on('error', reject);
                req.write(data);
                req.end();
            });
            console.log(`POST ${ep}: ${r.status} - ${r.body.substring(0, 200)}`);
        } catch(e) {
            console.log(`POST ${ep}: ERROR - ${e.message.substring(0, 100)}`);
        }
    }
}

main().catch(e => console.error(e));
