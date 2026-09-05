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
