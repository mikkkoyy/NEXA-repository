const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

describe('commands', () => {
  const commandsDir = path.join(__dirname, '..', 'src', 'commands');
  
  it('should have ping command', () => {
    const pingPath = path.join(commandsDir, 'ping.js');
    assert.ok(fs.existsSync(pingPath), 'ping.js should exist');
    
    const ping = require('../src/commands/ping.js');
    assert.ok(ping.data, 'ping command should have data');
    assert.strictEqual(ping.data.name, 'ping', 'command name should be ping');
    assert.ok(ping.data.description, 'command should have description');
    assert.strictEqual(ping.data.description, 'Check if NEXA is online');
    assert.ok(typeof ping.execute === 'function', 'ping should have execute function');
  });

  it('should have help command', () => {
    const helpPath = path.join(commandsDir, 'help.js');
    assert.ok(fs.existsSync(helpPath), 'help.js should exist');
    
    const help = require('../src/commands/help.js');
    assert.ok(help.data, 'help command should have data');
    assert.strictEqual(help.data.name, 'help', 'command name should be help');
    assert.ok(help.data.description, 'command should have description');
    assert.strictEqual(help.data.description, 'Show available NEXA commands');
    assert.ok(typeof help.execute === 'function', 'help should have execute function');
  });

  it('should have commands registry', () => {
    const commandsPath = path.join(commandsDir, 'commands.js');
    assert.ok(fs.existsSync(commandsPath), 'commands.js should exist');
    
    const { commands, getCommand } = require('../src/commands/commands.js');
    
    assert.ok(Array.isArray(commands), 'commands should be an array');
    assert.strictEqual(commands.length, 19, 'should have 19 commands');
    
    const commandNames = commands.map(c => c.data.name);
    assert.ok(commandNames.includes('ping'), 'should include ping command');
    assert.ok(commandNames.includes('help'), 'should include help command');
    assert.ok(commandNames.includes('profile'), 'should include profile command');
    
    const pingCmd = getCommand('ping');
    assert.ok(pingCmd, 'getCommand should find ping');
    assert.strictEqual(pingCmd.data.name, 'ping');
    
    const helpCmd = getCommand('help');
    assert.ok(helpCmd, 'getCommand should find help');
    assert.strictEqual(helpCmd.data.name, 'help');
    
const profileCmd = getCommand('profile');
    assert.ok(profileCmd, 'getCommand should find profile');
    assert.strictEqual(profileCmd.data.name, 'profile');

    const questCmd = getCommand('quest');
    assert.ok(questCmd, 'getCommand should find quest');
    assert.strictEqual(questCmd.data.name, 'quest');

    const questsCmd = getCommand('quests');
    assert.ok(questsCmd, 'getCommand should find quests');
    assert.strictEqual(questsCmd.data.name, 'quests');

    const unknown = getCommand('unknown');
    assert.strictEqual(unknown, undefined, 'getCommand should return undefined for unknown');
  });

  it('profile command should have import compatibility', () => {
    const profile = require('../src/commands/profile.js');
    assert.ok(profile.data, 'profile command should load without import errors');
    assert.strictEqual(profile.data.name, 'profile');
  });
});