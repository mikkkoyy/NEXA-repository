require('dotenv').config();

function loadConfig(env = process.env) {
  const DISCORD_TOKEN = env.DISCORD_TOKEN?.trim();
  const DISCORD_CLIENT_ID = env.DISCORD_CLIENT_ID;
  const DISCORD_GUILD_ID = env.DISCORD_GUILD_ID;
  const BACKUP_CHANNEL_ID = env.BACKUP_CHANNEL_ID || '';

  if (!DISCORD_TOKEN) {
    throw new Error('DISCORD_TOKEN is required');
  }

  if (!DISCORD_CLIENT_ID) {
    throw new Error('DISCORD_CLIENT_ID is required');
  }

  return {
    token: DISCORD_TOKEN,
    clientId: DISCORD_CLIENT_ID,
    guildId: DISCORD_GUILD_ID || null,
    backupChannelId: BACKUP_CHANNEL_ID,
    presence: {
      name: '/nexa • awakening...',
      type: 3
    }
  };
}

// For backward compatibility with existing usage patterns
const config = loadConfig();

module.exports = config;