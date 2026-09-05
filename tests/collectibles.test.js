const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const os = require('os');

const Database = require('../src/database/database');
const { migrate } = require('../src/database/schema');
const { ProfileRepository } = require('../src/identity/repository');
const { QuestRepository } = require('../src/quests/repository');
const { QuestService } = require('../src/quests/service');
const { CollectibleRepository } = require('../src/collectibles/repository');
const { DefaultQuests } = require('../src/quests/seed');
const { DefaultCollectibles } = require('../src/collectibles/seed');
const { StatusActive, StatusCompleted, StatusExpired } = require('../src/quests/model');
const { RarityCommon, RarityUncommon, RarityRare, RarityEpic, RarityLegendary, ErrNoSuchCollectible, ErrAlreadyOwned, rarityLabel, iconForRarity, memberCollectibleDisplayIcon } = require('../src/collectibles/model');

function createTestHarness() {
  const dbPath = path.join(os.tmpdir(), `nexa_collectibles_${Date.now()}_${Math.random()}.db`);
  const db = new Database(dbPath);
  migrate(db);

  const profile = new ProfileRepository(db);
  const collectibleRepo = new CollectibleRepository(db);
  const questRepo = new QuestRepository(db);
  const questService = new QuestService(questRepo, profile, collectibleRepo);

  let current = new Date('2026-09-04T12:00:00Z');
  questService.setNow(() => current);
  collectibleRepo._now = () => current;
  profile._now = () => current;

  const advance = (d) => { current = new Date(current.getTime() + d); };

  return { db, profile, collectibleRepo, questRepo, questService, advance, current: () => current };
}

function ensureProfile(profile, questService, guildID, userID, name) {
  profile.ensureProfile(null, guildID, userID, name, name, questService.now());
}

function findQuest(list, key) {
  return list.find(mq => mq.key === key);
}

function findCollectible(list, key) {
  return list.find(c => c.key === key);
}

describe('Collectibles Engine', () => {
  let harness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  afterEach(() => {
    harness.db.close();
  });

  describe('Default Collectibles', () => {
    it('has correct default collectibles', () => {
      const defs = DefaultCollectibles();
      assert.strictEqual(defs.length, 3);
      const keys = defs.map(d => d.Key);
      assert.ok(keys.includes('moon_shard'));
      assert.ok(keys.includes('ember_core'));
      assert.ok(keys.includes('static_relic'));
    });

    it('moon_shard has correct metadata', () => {
      const defs = DefaultCollectibles();
      const moon = defs.find(d => d.Key === 'moon_shard');
      assert.ok(moon);
      assert.strictEqual(moon.Name, 'Moon Shard');
      assert.strictEqual(moon.Rarity, RarityCommon);
      assert.strictEqual(moon.Icon, '🌙');
    });

    it('ember_core has correct metadata', () => {
      const defs = DefaultCollectibles();
      const ember = defs.find(d => d.Key === 'ember_core');
      assert.ok(ember);
      assert.strictEqual(ember.Name, 'Ember Core');
      assert.strictEqual(ember.Rarity, RarityUncommon);
      assert.strictEqual(ember.Icon, '🔥');
    });

    it('static_relic has correct metadata', () => {
      const defs = DefaultCollectibles();
      const relic = defs.find(d => d.Key === 'static_relic');
      assert.ok(relic);
      assert.strictEqual(relic.Name, 'Static Relic');
      assert.strictEqual(relic.Rarity, RarityRare);
      assert.strictEqual(relic.Icon, '⚡');
    });
  });

  describe('Seeding', () => {
    it('creates default collectibles', () => {
      harness.collectibleRepo.ensureGuildCollectibles('g1', harness.current());
      const rows = harness.db.db.prepare('SELECT COUNT(*) as cnt FROM collectibles WHERE guild_id = ?').get('g1');
      assert.strictEqual(rows.cnt, DefaultCollectibles().length);
    });

    it('seeding is idempotent', () => {
      harness.collectibleRepo.ensureGuildCollectibles('g1', harness.current());
      harness.collectibleRepo.ensureGuildCollectibles('g1', harness.current());
      const rows = harness.db.db.prepare('SELECT COUNT(*) as cnt FROM collectibles WHERE guild_id = ?').get('g1');
      assert.strictEqual(rows.cnt, DefaultCollectibles().length);
    });

    it('duplicate key prevention', () => {
      for (let i = 0; i < 3; i++) {
        harness.collectibleRepo.ensureGuildCollectibles('g1', harness.current());
      }
      const row = harness.db.db.prepare("SELECT COUNT(*) as cnt FROM collectibles WHERE guild_id = ? AND collectible_key = 'moon_shard'").get('g1');
      assert.strictEqual(row.cnt, 1);
    });
  });

  describe('Ownership', () => {
    it('can grant collectible', () => {
      harness.collectibleRepo.ensureGuildCollectibles('g1', harness.current());
      const [granted, err] = harness.collectibleRepo.grantCollectibleTx('g1', 'u1', 'moon_shard', 'quest', harness.current());
      assert.ok(!err);
      assert.ok(granted);
    });

    it('duplicate grant does not duplicate row', () => {
      harness.collectibleRepo.ensureGuildCollectibles('g1', harness.current());
      const [granted1, err1] = harness.collectibleRepo.grantCollectibleTx('g1', 'u1', 'moon_shard', 'quest', harness.current());
      assert.ok(!err1);
      assert.ok(granted1);

      const [granted2, err2] = harness.collectibleRepo.grantCollectibleTx('g1', 'u1', 'moon_shard', 'quest', harness.current());
      assert.ok(!err2);
      assert.ok(!granted2);

      const count = harness.db.db.prepare("SELECT COUNT(*) as cnt FROM member_collectibles WHERE guild_id = ? AND user_id = ? AND collectible_id IN (SELECT id FROM collectibles WHERE collectible_key = 'moon_shard')").get('g1', 'u1');
      assert.strictEqual(count.cnt, 1);
    });

    it('hasCollectible works', () => {
      harness.collectibleRepo.ensureGuildCollectibles('g1', harness.current());
      harness.collectibleRepo.grantCollectibleTx('g1', 'u1', 'moon_shard', 'quest', harness.current());
      const owned = harness.collectibleRepo.hasCollectible('g1', 'u1', 'moon_shard');
      assert.ok(owned);

      const notOwned = harness.collectibleRepo.hasCollectible('g1', 'u2', 'moon_shard');
      assert.ok(!notOwned);
    });

    it('getCollection works', () => {
      harness.collectibleRepo.ensureGuildCollectibles('g1', harness.current());
      const total = harness.collectibleRepo.collectionCount('g1');
      assert.strictEqual(total, 3);

      const collected = harness.collectibleRepo.getCollection('g1', 'u1');
      assert.strictEqual(collected.length, 0);

      harness.collectibleRepo.grantCollectibleTx('g1', 'u1', 'moon_shard', 'quest', harness.current());
      harness.collectibleRepo.grantCollectibleTx('g1', 'u1', 'ember_core', 'quest', harness.current());

      const collected2 = harness.collectibleRepo.getCollection('g1', 'u1');
      assert.strictEqual(collected2.length, 2);
      assert.strictEqual(collected2[0].rarity, RarityCommon);
      assert.strictEqual(collected2[1].rarity, RarityUncommon);
    });
  });

  describe('Isolation', () => {
    it('guild isolation', () => {
      harness.collectibleRepo.ensureGuildCollectibles('g1', harness.current());
      harness.collectibleRepo.ensureGuildCollectibles('g2', harness.current());

      harness.collectibleRepo.grantCollectibleTx('g1', 'u1', 'moon_shard', 'quest', harness.current());

      const owned = harness.collectibleRepo.hasCollectible('g2', 'u1', 'moon_shard');
      assert.ok(!owned);
    });

    it('user isolation', () => {
      harness.collectibleRepo.ensureGuildCollectibles('g1', harness.current());

      harness.collectibleRepo.grantCollectibleTx('g1', 'u1', 'moon_shard', 'quest', harness.current());

      const owned = harness.collectibleRepo.hasCollectible('g1', 'u2', 'moon_shard');
      assert.ok(!owned);
    });
  });

  describe('Persistence', () => {
    it('ownership survives reopen', () => {
      const dbPath = path.join(os.tmpdir(), `nexa_collectibles_persist_${Date.now()}_${Math.random()}.db`);

      {
        const db = new Database(dbPath);
        migrate(db);
        const collectibleRepo = new CollectibleRepository(db);
        collectibleRepo.ensureGuildCollectibles('g1', new Date());
        collectibleRepo.grantCollectibleTx('g1', 'u1', 'moon_shard', 'quest', new Date());
        db.close();
      }

      {
        const db = new Database(dbPath);
        migrate(db);
        const collectibleRepo = new CollectibleRepository(db);
        const owned = collectibleRepo.hasCollectible('g1', 'u1', 'moon_shard');
        assert.ok(owned);
        db.close();
      }
    });
  });

  describe('Concurrency', () => {
    it('handles concurrent grant without duplicate', () => {
      harness.collectibleRepo.ensureGuildCollectibles('g1', harness.current());

      const workers = 12;
      const promises = [];
      for (let i = 0; i < workers; i++) {
        promises.push(Promise.resolve(harness.collectibleRepo.grantCollectibleTx('g1', 'u1', 'moon_shard', 'quest', harness.current())));
      }
      Promise.all(promises).catch(e => {});

      const count = harness.db.db.prepare("SELECT COUNT(*) as cnt FROM member_collectibles WHERE guild_id = ? AND user_id = ? AND collectible_id IN (SELECT id FROM collectibles WHERE collectible_key = 'moon_shard')").get('g1', 'u1');
      assert.strictEqual(count.cnt, 1);
    });
  });

  describe('Model Helpers', () => {
    it('rarityLabel formats correctly', () => {
      assert.strictEqual(rarityLabel(RarityCommon), 'Common');
      assert.strictEqual(rarityLabel(RarityUncommon), 'Uncommon');
      assert.strictEqual(rarityLabel(RarityRare), 'Rare');
      assert.strictEqual(rarityLabel(RarityEpic), 'Epic');
      assert.strictEqual(rarityLabel(RarityLegendary), 'Legendary');
      assert.strictEqual(rarityLabel('unknown'), 'unknown');
    });

    it('iconForRarity returns fallback icons', () => {
      assert.strictEqual(iconForRarity(RarityCommon), '⚪');
      assert.strictEqual(iconForRarity(RarityUncommon), '🟢');
      assert.strictEqual(iconForRarity(RarityRare), '🔵');
      assert.strictEqual(iconForRarity(RarityEpic), '🟣');
      assert.strictEqual(iconForRarity(RarityLegendary), '⭐');
      assert.strictEqual(iconForRarity('unknown'), '❓');
    });

    it('memberCollectibleDisplayIcon uses icon or fallback', () => {
      const mc1 = { icon: '🌙', rarity: RarityCommon };
      assert.strictEqual(memberCollectibleDisplayIcon(mc1), '🌙');

      const mc2 = { icon: '', rarity: RarityUncommon };
      assert.strictEqual(memberCollectibleDisplayIcon(mc2), '🟢');
    });
  });

  describe('Quest Integration', () => {
    it('first_steps completion grants XP + Moon Shard', () => {
      harness.collectibleRepo.ensureGuildCollectibles('g1', harness.current());
      ensureProfile(harness.profile, harness.questService, 'g1', 'u1', 'user1');
      harness.questService.recordActivity('g1', 'u1');

      const list = harness.questService.getMemberQuests('g1', 'u1');
      const firstSteps = findQuest(list, 'first_steps');
      assert.ok(firstSteps);
      assert.strictEqual(firstSteps.status, StatusCompleted);

      const profile = harness.profile.getProfile(null, 'g1', 'u1');
      assert.strictEqual(profile.xp, 10);

      const owned = harness.collectibleRepo.hasCollectible('g1', 'u1', 'moon_shard');
      assert.ok(owned);
    });

    it('duplicate completion does not duplicate collectible', () => {
      harness.collectibleRepo.ensureGuildCollectibles('g1', harness.current());
      ensureProfile(harness.profile, harness.questService, 'g1', 'u1', 'user1');
      for (let i = 0; i < 5; i++) {
        harness.questService.recordActivity('g1', 'u1');
      }

      const profile = harness.profile.getProfile(null, 'g1', 'u1');
      // first_steps (10) + social_presence (25) = 35
      assert.strictEqual(profile.xp, 35);

      const count = harness.db.db.prepare("SELECT COUNT(*) as cnt FROM member_collectibles WHERE guild_id = ? AND user_id = ? AND collectible_id IN (SELECT id FROM collectibles WHERE collectible_key = 'moon_shard')").get('g1', 'u1');
      assert.strictEqual(count.cnt, 1);
    });
  });
});