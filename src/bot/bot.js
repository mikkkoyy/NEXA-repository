const { Client, GatewayIntentBits, RESTEvents } = require('discord.js');
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

// Permanent operational visibility: Discord's rate limiter is per-bot-token
// for authenticated requests (not per-IP), so if the gateway login process
// ever stalls again, this tells us immediately whether it's because we hit
// an API rate limit, and on which route.
client.rest.on(RESTEvents.RateLimited, (info) => {
  console.warn('[NEXA] Discord API rate limit hit:', JSON.stringify({
    route: info.route,
    method: info.method,
    global: info.global,
    scope: info.scope,
    retryAfterMs: info.retryAfter,
  }));
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

async function startBot() {
  return new Promise((resolve, reject) => {
    client.on('shardDisconnect', (event) => {
      console.log('Discord shard disconnect:', 'code=' + event.code, 'reason=' + (event.reason || 'none'));
    });

    const loginTimeout = setTimeout(() => {
      console.error('Discord login timed out after 60s');
      console.error('client.ws.status:', client.ws.status);
      console.error('[NEXA] No READY event and no rejected login promise within 60s. If this recurs, check the logs above for a "[NEXA] Discord API rate limit hit" line (identify/session-start-limit exhaustion, often from repeated rapid restarts) before assuming a network fault — Discord REST/API reachability was already confirmed separately.');
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
