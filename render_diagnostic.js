#!/usr/bin/env node

/**
 * NEXA Render Diagnostic Script
 * This script runs diagnostics on Render to identify Discord Gateway connection issues.
 * NO SECRETS ARE LOGGED - only safe metadata is reported.
 */

const https = require('https');
const http = require('http');
const dns = require('dns');
const WebSocket = require('ws');

console.log('=== NEXA RENDER DIAGNOSTIC ===');
console.log('Node version:', process.version);

// ============================================
// TOKEN DIAGNOSTICS
// ============================================
console.log('\n--- TOKEN DIAGNOSTICS ---');

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

console.log('DISCORD_TOKEN present:', token ? 'YES' : 'NO');
if (token) {
  console.log('DISCORD_TOKEN length:', token.length);
  console.log('DISCORD_TOKEN starts with whitespace:', /^\s/.test(token) ? 'YES' : 'no');
  console.log('DISCORD_TOKEN ends with whitespace:', /\s$/.test(token) ? 'YES' : 'no');
  console.log('DISCORD_TOKEN contains internal whitespace:', /\s/.test(token.slice(1, -1)) ? 'YES' : 'no');
}
console.log('DISCORD_CLIENT_ID present:', clientId ? 'YES' : 'NO');
console.log('DISCORD_GUILD_ID present:', guildId ? 'YES' : 'NO');

// ============================================
// HELPER: Make HTTP request
// ============================================
function makeRequest(url, authToken) {
  return new Promise((resolve) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'Authorization': 'Bot ' + authToken,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    };

    const req = (urlObj.protocol === 'https:' ? https : http).request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, data: data });
      });
    });

    req.on('error', (e) => resolve({ status: 0, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, error: 'timeout' }); });
    req.end();
  });
}

// ============================================
// DISCORD API AUTHENTICATION TEST (Step 3)
// ============================================
console.log('\n--- DISCORD API AUTHENTICATION TEST ---');

async function testAuth() {
  if (!token) {
    console.log('RESULT: SKIPPED - no token');
    return 'SKIPPED';
  }

  console.log('Testing authenticated request to /users/@me...');
  const result = await makeRequest('https://discord.com/api/v10/users/@me', token);

  if (result.error) {
    console.log('RESULT: REQUEST ERROR -', result.error);
    return 'ERROR';
  }

  console.log('HTTP Status:', result.status);

  if (result.status === 200) {
    console.log('RESULT: Token is VALID and authenticated');
    return 'VALID';
  } else if (result.status === 401) {
    console.log('RESULT: Token is INVALID (401)');
    return 'INVALID';
  } else {
    console.log('RESULT: Unexpected status');
    return 'UNKNOWN';
  }
}

// ============================================
// GATEWAY ENDPOINT TEST (Step 4)
// ============================================
console.log('\n--- GATEWAY ENDPOINT TEST ---');

async function testGatewayEndpoint() {
  if (!token) {
    console.log('RESULT: SKIPPED - no token');
    return { status: 'SKIPPED', url: null };
  }

  console.log('Fetching Gateway URL from /gateway...');
  const result = await makeRequest('https://discord.com/api/v10/gateway', token);

  if (result.error) {
    console.log('RESULT: REQUEST ERROR -', result.error);
    return { status: 'ERROR', url: null };
  }

  console.log('HTTP Status:', result.status);

  if (result.status === 200) {
    try {
      const json = JSON.parse(result.data);
      if (json.url) {
        console.log('RESULT: Gateway URL obtained');
        return { status: 'OK', url: json.url };
      }
    } catch (e) {
      console.log('RESULT: Parse error');
      return { status: 'PARSE_ERROR', url: null };
    }
  } else if (result.status === 401) {
    console.log('RESULT: Unauthorized (invalid token)');
    return { status: 'UNAUTHORIZED', url: null };
  }

  console.log('RESULT: Unexpected response');
  return { status: 'UNKNOWN', url: null };
}

// ============================================
// RAW WEBSOCKET TEST (Step 5)
// ============================================
console.log('\n--- RAW WEBSOCKET CONNECTIVITY TEST ---');

async function testWebSocket(gatewayUrl) {
  return new Promise((resolve) => {
    if (!gatewayUrl) {
      console.log('RESULT: SKIPPED - no gateway URL');
      resolve({ result: 'SKIPPED' });
      return;
    }

    console.log('Gateway URL:', gatewayUrl.replace(/\?.*$/, ''));

    // DNS Test
    const gatewayHost = new URL(gatewayUrl).hostname;
    console.log('DNS test for', gatewayHost + ':', 'starting...');

    dns.lookup(gatewayHost, (dnsErr, address, family) => {
      if (dnsErr) {
        console.log('DNS FAILED:', dnsErr.message);
      } else {
        console.log('DNS OK:', address, '(IPv' + family + ')');
      }

      // WebSocket Test
      console.log('WebSocket connection test:', 'starting...');
      const wsStart = Date.now();

      try {
        const ws = new WebSocket(gatewayUrl);

        const timeout = setTimeout(() => {
          console.log('WebSocket TIMEOUT after 20 seconds');
          ws.close();
        }, 20000);

        ws.on('open', () => {
          const elapsed = Date.now() - wsStart;
          console.log('WebSocket OPEN after', elapsed + 'ms');
          console.log('RESULT: WebSocket connection SUCCESSFUL');
          clearTimeout(timeout);
          ws.close();
          resolve({ result: 'SUCCESS', elapsed: elapsed });
        });

        ws.on('error', (error) => {
          console.log('WebSocket ERROR:', error.message);
          clearTimeout(timeout);
          resolve({ result: 'ERROR', error: error.message });
        });

        ws.on('close', (code, reason) => {
          console.log('WebSocket CLOSED:', 'code=' + code, 'reason=' + (reason ? reason.toString() : 'none'));
        });

        ws.on('message', (data) => {
          console.log('WebSocket MESSAGE received:', data.toString().substring(0, 100));
        });

      } catch (e) {
        console.log('WebSocket EXCEPTION:', e.message);
        resolve({ result: 'EXCEPTION', error: e.message });
      }
    });
  });
}

// ============================================
// RUN ALL TESTS
// ============================================
async function runDiagnostics() {
  const authResult = await testAuth();
  const gatewayResult = await testGatewayEndpoint();
  const wsResult = await testWebSocket(gatewayResult.url);

  console.log('\n=== DIAGNOSTIC SUMMARY ===');
  console.log('Token present:', token ? 'YES' : 'NO');
  console.log('Token whitespace:', (token && (/\s/.test(token)) ? 'YES' : 'no'));
  console.log('Auth test:', authResult);
  console.log('Gateway endpoint:', gatewayResult.status);
  console.log('WebSocket test:', wsResult.result || 'SKIPPED');

  console.log('\n=== INTERPRETATION ===');
  if (authResult === 'VALID' && wsResult.result === 'SUCCESS') {
    console.log('RESULT: Token valid AND WebSocket connects');
    console.log('ROOT CAUSE: Likely discord.js client configuration or lifecycle issue');
  } else if (authResult === 'INVALID') {
    console.log('ROOT CAUSE: Token authentication failure (401)');
  } else if (wsResult.result === 'ERROR' || wsResult.result === 'EXCEPTION') {
    console.log('ROOT CAUSE: Render cannot connect to Discord Gateway WebSocket');
  } else if (authResult === 'VALID' && (!wsResult.result || wsResult.result === 'SKIPPED')) {
    console.log('ROOT CAUSE: WebSocket connection issue (requires further diagnosis)');
  }

  console.log('\nDiagnostic complete.');
  process.exit(0);
}

runDiagnostics();
