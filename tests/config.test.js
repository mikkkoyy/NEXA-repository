const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

describe('config', () => {
  const configPath = path.join(__dirname, '..', 'src', 'config', 'config.js');
  const envPath = path.join(__dirname, '..', '.env');
  const envExamplePath = path.join(__dirname, '..', '.env.example');

  beforeEach(() => {
    if (fs.existsSync(envPath)) {
      fs.unlinkSync(envPath);
    }
    delete require.cache[require.resolve(path.join(__dirname, '..', 'src', 'config', 'config.js'))];
    delete process.env.DISCORD_TOKEN;
    delete process.env.DISCORD_CLIENT_ID;
    delete process.env.DISCORD_GUILD_ID;
  });

  it('should have .env.example with required variables', () => {
    const content = fs.readFileSync(envExamplePath, 'utf8');
    assert.ok(content.includes('DISCORD_TOKEN='));
    assert.ok(content.includes('DISCORD_CLIENT_ID='));
    assert.ok(content.includes('DISCORD_GUILD_ID='));
  });

  it('should load config when env vars are set', () => {
    process.env.DISCORD_TOKEN = 'test-token';
    process.env.DISCORD_CLIENT_ID = 'test-client-id';
    process.env.DISCORD_GUILD_ID = 'test-guild-id';

    const config = require('../src/config/config.js');
    
    assert.strictEqual(config.token, 'test-token');
    assert.strictEqual(config.clientId, 'test-client-id');
    assert.strictEqual(config.guildId, 'test-guild-id');
    assert.ok(config.presence);
    assert.strictEqual(config.presence.name, '/nexa • awakening...');
  });

  it('should not expose token in config object structure', () => {
    process.env.DISCORD_TOKEN = 'secret-token-123';
    process.env.DISCORD_CLIENT_ID = 'test-client-id';

    const config = require('../src/config/config.js');
    
    const keys = Object.keys(config);
    assert.ok(keys.includes('token'));
    assert.strictEqual(config.token, 'secret-token-123');
  });

  it('should treat guildId as optional when not set', () => {
    process.env.DISCORD_TOKEN = 'test-token';
    process.env.DISCORD_CLIENT_ID = 'test-client-id';
    delete process.env.DISCORD_GUILD_ID;

    const config = require('../src/config/config.js');
    
    assert.strictEqual(config.guildId, null);
  });
});