const { startBot, setupShutdownHandlers } = require('./bot/bot');

console.log('NEXA starting...');

setupShutdownHandlers();

startBot().catch((err) => {
  console.error('Failed to start NEXA:', err.message);
  process.exit(1);
});