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

// Initialize and migrate database
const database = new Database(':memory:');
migrate(database);

// 1. GLOBAL SCOPE DECLARATION: Fixes ReferenceError on module.exports
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
      client.destroy();
      reject(new Error('Discord login timed out'));
    }, 60000);

    client.once('ready', async () => {
      clearTimeout(loginTimeout);
      console.log('NEXA connected to Discord');

      // Asynchronously handle initializations to prevent blocking the event loop heartbeat
      setImmediate(async () => {
        try {
          await restoreSnapshot();
        } catch (err) {
          console.error('[Database] Snapshot restore error:', err.message);
        }

        try {
          // Destructure all repositories perfectly including creator components
          const { 
            profileRepo, questRepo, collectibleRepo, achievementRepo, 
            economyRepo, worldRepo, paymentsRepo, analyticsRepo,
            creatorRepo, creatorContentRepo, creatorMarketplaceRepo, creatorEarningsRepo 
          } = setupRepositories();

          setupServices({ 
            profileRepo, questRepo, collectibleRepo, achievementRepo, 
            economyRepo, worldRepo, paymentsRepo, analyticsRepo,
            creatorRepo, creatorContentRepo, creatorMarketplaceRepo, creatorEarningsRepo 
          });
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
