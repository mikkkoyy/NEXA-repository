// Prefer IPv4 for outbound DNS lookups. Cheap, standard hardening for
// containerized hosts; must run before discord.js or anything else that
// makes a network request loads. (Confirmed not the root cause of the
// gateway hang on this deployment, but harmless and worth keeping.)
const dns = require('node:dns');
dns.setDefaultResultOrder('ipv4first');

const http = require('http');
const { startBot } = require('./bot/bot');

const port = process.env.PORT || 10000;

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('NEXA OK');
}).listen(port, '0.0.0.0', () => {
  console.log(`NEXA health server listening on port ${port}`);
});

console.log('NEXA starting...');

startBot().catch((err) => {
  console.error('Failed to start NEXA:', err.message);
  process.exit(1);
});
