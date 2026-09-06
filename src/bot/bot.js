const { Client, GatewayIntentBits } = require('discord.js');
const config = require('../config/config');
const { commands } = require('../commands/commands');
const Database = require('../database/database');
const { migrate } = require('../database/schema');
const ProfileRepository = require('../identity/repository');
const { QuestRepository } = require('../quests/repository');
const { CollectibleRepository } = require('../collectibles/repository');
const { AchievementRepository } = require('../achievements/repository');
const { EconomyRepository } = require('../economy/repository');
const { WorldRepository } = require('../world/repository');
const { PaymentsRepository } = require('../payments/repository');
const { AnalyticsRepository } = require('../analytics/repository');
const CreatorMarketplaceRepository = require('../creator/marketplace-repository');
const CreatorMarketplaceService = require('../creator/marketplace-service');
const CreatorEarningsRepository = require('../creator/earnings-repository');
const CreatorEarningsService = require('../creator/earnings-service');
const CreatorContentRepository = require('../creator/content-repository');
const CreatorContentService = require('../creator/content-service');
const CreatorRepository = require('../creator/repository');
const CreatorService = require('../creator/service');
const IdentityService = require('../identity/service');
const QuestService = require('../quests/service');
const AchievementService = require('../achievements/service');
const EconomyService = require('../economy/service');
const WorldService = require('../world/service');
const PaymentsService = require('../payments/service');

let isShuttingDown = false;
let backupInterval = null;

const database = new Database(':memory:');
migrate(database);

console.log('Creating Discord client...');
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ]
});

console.log('Registering Discord event handlers...');
client.on('error', (err) => {
  console.error('Discord client error:', err.message);
});

client.on('shardError', (err) => {
  console.error('Discord shard error:', err.message);
});

// TEMPORARY DIAGNOSTIC: surfaces discord.js's internal connection-lifecycle
// logging (fetching gateway info, opening the socket, identify/resume, etc.)
// so we can see exactly which step it's stuck on instead of just a blank
// 60-second gap. Safe to remove once the connection issue is resolved.
client.on('debug', (info) => {
  console.log('[Discord Debug]', info);
});

function setupRepositories() {
  const profileRepo = new ProfileRepository(database);
  const questRepo = new QuestRepository(database);
  const collectibleRepo = new CollectibleRepository(database);
  const achievementRepo = new AchievementRepository(database);
  const economyRepo = new EconomyRepository(database);
  const worldRepo = new WorldRepository(database);
  const paymentsRepo = new PaymentsRepository(database);
  const analyticsRepo = new AnalyticsRepository(database);
  const creatorRepo = new CreatorRepository(database);
  const creatorContentRepo = new CreatorContentRepository(database);
  const creatorMarketplaceRepo = new CreatorMarketplaceRepository(database);
  const creatorEarningsRepo = new CreatorEarningsRepository(database);

  client.profileRepository = profileRepo;
  client.questRepository = questRepo;
  client.collectibleRepository = collectibleRepo;
  client.achievementRepository = achievementRepo;
  client.economyRepository = economyRepo;
  client.worldRepository = worldRepo;
  client.paymentsRepository = paymentsRepo;
  client.analyticsRepository = analyticsRepo;
  client.creatorRepository = creatorRepo;
  client.creatorContentRepository = creatorContentRepo;
  client.creatorMarketplaceRepository = creatorMarketplaceRepo;
  client.creatorEarningsRepository = creatorEarningsRepo;

  return { profileRepo, questRepo, collectibleRepo, achievementRepo, economyRepo, worldRepo, paymentsRepo, analyticsRepo, creatorRepo, creatorContentRepo, creatorMarketplaceRepo, creatorEarningsRepo };
}

function setupServices({ profileRepo, questRepo, collectibleRepo, achievementRepo, economyRepo, worldRepo, paymentsRepo, creatorRepo, creatorContentRepo, creatorMarketplaceRepo, creatorEarningsRepo }) {
  const identityService = new IdentityService(profileRepo);
  client.identityService = identityService;

  const questService = new QuestService(questRepo, profileRepo, collectibleRepo);
  client.questService = questService;

  const achievementService = new AchievementService(achievementRepo, profileRepo);
  client.achievementService = achievementService;

  const economyService = new EconomyService(economyRepo);
  client.economyService = economyService;

  const worldService = new WorldService(worldRepo);
  client.worldService = worldService;

  const paymentsService = new PaymentsService(paymentsRepo, process.env.NEXA_PAYMENT_TEST_MODE === 'true');
  client.paymentsService = paymentsService;

  const creatorService = new CreatorService(creatorRepo);
  client.creatorService = creatorService;

  const creatorContentService = new CreatorContentService(creatorContentRepo);
  client.creatorContentService = creatorContentService;

  const creatorMarketplaceService = new CreatorMarketplaceService(creatorMarketplaceRepo);
  client.creatorMarketplaceService = creatorMarketplaceService;

  const creatorEarningsService = new CreatorEarningsService(creatorEarningsRepo, paymentsRepo);
  client.creatorEarningsService = creatorEarningsService;
}

async function registerCommands() {
  const rest = client.rest;

  if (config.guildId) {
    const guild = await client.guilds.fetch(config.guildId);
    await guild.commands.set(commands.map(cmd => cmd.data));
  } else {
    await rest.put(
      `/applications/${config.clientId}/commands`,
      { body: commands.map(cmd => cmd.data.toJSON()) }
    );
  }
}

async function doBackup() {
  const buffer = database.serialize();

  const channel = await client.channels.fetch(config.backupChannelId);
  if (!channel || channel.type !== 0) {
    console.error('[Database] Backup channel not found');
    return;
  }

  try {
    await channel.send({
      files: [
        {
          attachment: buffer,
          name: 'nexa_cloud.db'
        }
      ]
    });
    console.log('[Database] Snapshot uploaded successfully.');
  } catch (err) {
    console.error('[Database] Backup failed:', err.message);
  }
}

async function startBackupTimer() {
  try {
    await doBackup();

    if (backupInterval) {
      clearInterval(backupInterval);
    }
    backupInterval = setInterval(doBackup, 10 * 60 * 1000);
  } catch (err) {
    console.error('[Database] Backup timer error:', err.message);
  }
}

async function restoreSnapshot() {
  const backupChannelId = config.backupChannelId;
  if (!backupChannelId) {
    console.log('[Database] No backup channel configured. Starting fresh database.');
    return;
  }

  const channel = await client.channels.fetch(backupChannelId);
  if (!channel || channel.type !== 0) {
    console.log('[Database] Backup channel not found. Starting fresh database.');
    return;
  }

  const attachments = await channel.messages.fetch({
    limit: 50
  }).then(messages => {
    const dbAttachments = messages.map(msg => msg.attachments).flat();
    const nexaAttachments = dbAttachments.filter(
      att => att.name === 'nexa_cloud.db'
    );
    return nexaAttachments.sort((a, b) => b.createdTimestamp - a.createdTimestamp);
  });

  if (attachments.length === 0) {
    console.log('[Database] No Discord snapshot found. Starting fresh database.');
    return;
  }

  const newest = attachments[0];
  try {
    const buffer = await newest.download();
    const better = require('better-sqlite3');
    const restoredDb = new better(buffer);

    database.db.close();
    database.db = restoredDb;
    database.db.pragma('busy_timeout = 5000');
    database.db.pragma('foreign_keys = ON');
    database.db.pragma('synchronous = NORMAL');
    database.db.pragma('journal_mode = WAL');

    console.log('[Database] Snapshot found.');
    console.log('[Database] Snapshot restored successfully.');
  } catch (err) {
    console.error('[Database] Snapshot restore failed:', err.message);
  }
}

// TEMPORARY DIAGNOSTIC: makes a plain HTTPS request to Discord's REST API,
// completely outside discord.js, with its own short timeout. This tells us
// within ~15s whether this host can reach Discord at all over HTTPS, instead
// of waiting the full 60s to find out indirectly. Safe to remove once the
// connection issue is resolved.
function checkDiscordReachable() {
  const https = require('https');
  return new Promise((resolve) => {
    const start = Date.now();
    const req = https.get(
      'https://discord.com/api/v10/gateway',
      { timeout: 15000, headers: { 'User-Agent': 'nexa-diagnostic/1.0' } },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          console.log(`[Diagnostic] Discord REST reachable in ${Date.now() - start}ms. Status: ${res.statusCode}`);
          resolve(true);
        });
      }
    );
    req.on('timeout', () => {
      console.error(`[Diagnostic] Discord REST request TIMED OUT after ${Date.now() - start}ms (no response) — this points to a network/firewall problem between this host and Discord, not a code or token issue.`);
      req.destroy();
      resolve(false);
    });
    req.on('error', (err) => {
      console.error(`[Diagnostic] Discord REST request ERRORED after ${Date.now() - start}ms:`, err.code || err.message);
      resolve(false);
    });
  });
}

async function startBot() {
  console.log('[Diagnostic] config.token present:', typeof config.token === 'string' && config.token.length > 0, '- length:', config.token ? config.token.length : 0);

  const reachable = await checkDiscordReachable();
  console.log('[Diagnostic] Discord REST reachability check result:', reachable ? 'REACHABLE' : 'UNREACHABLE');

  return new Promise((resolve, reject) => {
    client.on('shardDisconnect', (event) => {
      console.log('Discord shard disconnect:', 'code=' + event.code, 'reason=' + (event.reason || 'none'));
    });

    const loginTimeout = setTimeout(() => {
      console.error('Discord login timed out after 60s');
      console.error('client.ws.status:', client.ws.status);
      client.destroy();
      reject(new Error('Discord login timed out'));
    }, 60000);

    client.once('ready', async () => {
      clearTimeout(loginTimeout);
      console.log('NEXA connected to Discord');

      try {
        await restoreSnapshot();
      } catch (err) {
        console.error('[Database] Snapshot restore error:', err.message);
      }

      try {
        const repos = setupRepositories();
        setupServices(repos);
      } catch (err) {
        console.error('Failed to setup services:', err.message);
      }

      try {
        await registerCommands();
        console.log('Commands registered');
      } catch (err) {
        console.error('Failed to register commands:', err.message);
      }

      try {
        await client.user.setPresence({
          activities: [{ name: config.presence.name, type: config.presence.type }],
          status: 'online'
        });
      } catch (err) {
        console.error('Failed to set presence:', err.message);
      }

      try {
        await startBackupTimer();
      } catch (err) {
        console.error('Failed to start backup timer:', err.message);
      }

      resolve();
      console.log('NEXA ready');
    });

    client.on('interactionCreate', async (interaction) => {
      if (!interaction.isChatInputCommand()) return;

      const command = commands.find(cmd => cmd.data.name === interaction.commandName);
      if (!command) return;

      try {
        await command.execute(interaction);
      } catch (err) {
        console.error(`Error executing ${interaction.commandName}:`, err.message);
        if (interaction.replied || interaction.deferred) {
          await interaction.editReply('An error occurred while executing this command.');
        } else {
          await interaction.reply('An error occurred while executing this command.');
        }
      }
    });

    client.on('messageCreate', async (message) => {
      if (message.author.bot) return;
      if (!message.guild) return;

      try {
        const identityService = client.identityService;
        if (identityService) {
          await identityService.recordMessage(
            message,
            message.guild.id,
            message.author.id,
            message.author.username,
            message.member?.nickname || message.author.displayName || message.author.username
          );
        }
      } catch (err) {
        console.error('Error recording message activity:', err.message);
      }

      try {
        const questService = client.questService;
        if (questService) {
          questService.recordActivity(message.guild.id, message.author.id);
        }
      } catch (err) {
        console.error('Error recording quest activity:', err.message);
      }

      try {
        const achievementService = client.achievementService;
        if (achievementService) {
          achievementService.recordActivity(message.guild.id, message.author.id);
        }
      } catch (err) {
        console.error('Error recording achievement activity:', err.message);
      }
    });

    client.login(config.token)
      .then(() => {
        // Login successful, timeout cleared by ready event
      })
      .catch((err) => {
        clearTimeout(loginTimeout);
        console.error('Discord login error:', err.message);
        reject(err);
      });

  });
}

async function shutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log('NEXA shutting down...');

  if (client && client.isReady()) {
    client.destroy();
  }

  if (backupInterval) {
    clearInterval(backupInterval);
  }

  console.log('NEXA shutdown complete');
}

function setupShutdownHandlers() {
  process.on('SIGINT', () => {
    console.log('\nReceived SIGINT');
    shutdown().then(() => process.exit(0));
  });

  process.on('SIGTERM', () => {
    console.log('\nReceived SIGTERM');
    shutdown().then(() => process.exit(0));
  });
}

module.exports = {
  client,
  startBot,
  shutdown,
  setupShutdownHandlers,
};
