const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const os = require('os');

const Database = require('../src/database/database');
const { migrate } = require('../src/database/schema');
const { ProfileRepository } = require('../src/identity/repository');
const { QuestRepository } = require('../src/quests/repository');
const { QuestService } = require('../src/quests/service');
const { DefaultQuests, ObjectiveMessageCount } = require('../src/quests/seed');
const { StatusActive, StatusCompleted, StatusExpired } = require('../src/quests/model');

function createTestHarness() {
  const dbPath = path.join(os.tmpdir(), `nexa_quests_${Date.now()}_${Math.random()}.db`);
  const db = new Database(dbPath);
  migrate(db);

  const profile = new ProfileRepository(db);
  const questRepo = new QuestRepository(db);
  const service = new QuestService(questRepo, profile);

  let current = new Date('2026-09-04T12:00:00Z');
  service.setNow(() => current);
  questRepo._now = () => current;
  profile._now = () => current;

  const advance = (d) => { current = new Date(current.getTime() + d); };

  return { db, profile, questRepo, service, advance, current: () => current };
}

function ensureProfile(profile, service, guildID, userID, name) {
  profile.ensureProfile(null, guildID, userID, name, name, service.now());
}

function findQuest(list, key) {
  return list.find(mq => mq.key === key);
}

describe('Quest Engine', () => {
  let harness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  afterEach(() => {
    harness.db.close();
  });

  describe('Seed', () => {
    it('creates default quests', () => {
      harness.service.ensureQuestAccess('g1', 'u1');
      const rows = harness.db.db.prepare('SELECT COUNT(*) as cnt FROM quests WHERE guild_id = ?').get('g1');
      assert.strictEqual(rows.cnt, DefaultQuests().length);
    });

    it('is idempotent', () => {
      harness.service.ensureQuestAccess('g1', 'u1');
      harness.service.ensureQuestAccess('g1', 'u1');
      const rows = harness.db.db.prepare('SELECT COUNT(*) as cnt FROM quests WHERE guild_id = ?').get('g1');
      assert.strictEqual(rows.cnt, DefaultQuests().length);
    });
  });

  describe('Assignment', () => {
    it('assigns quests to member', () => {
      harness.service.ensureQuestAccess('g1', 'u1');
      const rows = harness.db.db.prepare('SELECT COUNT(*) as cnt FROM member_quests WHERE guild_id = ? AND user_id = ?').get('g1', 'u1');
      assert.strictEqual(rows.cnt, DefaultQuests().length);
    });

    it('is idempotent for member', () => {
      harness.service.ensureQuestAccess('g1', 'u1');
      harness.service.ensureQuestAccess('g1', 'u1');
      const rows = harness.db.db.prepare('SELECT COUNT(*) as cnt FROM member_quests WHERE guild_id = ? AND user_id = ?').get('g1', 'u1');
      assert.strictEqual(rows.cnt, DefaultQuests().length);
    });
  });

  describe('Progress', () => {
    it('first message completes first_steps', () => {
      ensureProfile(harness.profile, harness.service, 'g1', 'u1', 'user1');
      harness.service.recordActivity('g1', 'u1');

      const list = harness.service.getMemberQuests('g1', 'u1');
      const mq = findQuest(list, 'first_steps');
      assert.ok(mq);
      assert.strictEqual(mq.progress, 1);
      assert.strictEqual(mq.status, StatusCompleted);
      assert.ok(mq.rewardClaimed);
    });

    it('advances to target and stops', () => {
      ensureProfile(harness.profile, harness.service, 'g1', 'u1', 'user1');

      for (let i = 0; i < 6; i++) {
        harness.service.recordActivity('g1', 'u1');
      }

      const list = harness.service.getMemberQuests('g1', 'u1');
      const social = findQuest(list, 'social_presence');
      assert.ok(social);
      assert.strictEqual(social.progress, 5);
      assert.strictEqual(social.status, StatusCompleted);
      assert.ok(social.completedAt);
    });

    it('does not progress after completion', () => {
      ensureProfile(harness.profile, harness.service, 'g1', 'u1', 'user1');

      for (let i = 0; i < 6; i++) {
        harness.service.recordActivity('g1', 'u1');
      }

      const list = harness.service.getMemberQuests('g1', 'u1');
      const social = findQuest(list, 'social_presence');
      assert.strictEqual(social.progress, 5);

      harness.service.recordActivity('g1', 'u1');
      const list2 = harness.service.getMemberQuests('g1', 'u1');
      const social2 = findQuest(list2, 'social_presence');
      assert.strictEqual(social2.progress, 5);
    });
  });

  describe('Rewards', () => {
    it('awards XP on completion', () => {
      ensureProfile(harness.profile, harness.service, 'g1', 'u1', 'user1');
      harness.service.recordActivity('g1', 'u1');

      const p = harness.profile.getProfile(null, 'g1', 'u1');
      assert.strictEqual(p.xp, 10);
    });

    it('awards XP exactly once', () => {
      ensureProfile(harness.profile, harness.service, 'g1', 'u1', 'user1');

      for (let i = 0; i < 5; i++) {
        harness.service.recordActivity('g1', 'u1');
      }

      const p = harness.profile.getProfile(null, 'g1', 'u1');
      assert.strictEqual(p.xp, 35);
    });
  });

  describe('Expiration', () => {
    it('expired quests do not progress', () => {
      const dbPath = path.join(os.tmpdir(), `nexa_expire_${Date.now()}_${Math.random()}.db`);
      const db = new Database(dbPath);
      migrate(db);

      const defs = [{
        Key: 'timed',
        Name: 'Timed',
        Description: 'A timed quest.',
        Target: 2,
        XP: 100,
        CollectibleRewardKey: '',
        DurationSeconds: 10
      }];

      const profile = new ProfileRepository(db);
      const questRepo = new QuestRepository(db, defs);
      const service = new QuestService(questRepo, profile);

      let current = new Date('2026-09-04T12:00:00Z');
      service.setNow(() => current);
      questRepo._now = () => current;

      ensureProfile(profile, service, 'g1', 'u1', 'user1');
      service.recordActivity('g1', 'u1');

      current = new Date(current.getTime() + 30000);
      service.recordActivity('g1', 'u1');
      service.recordActivity('g1', 'u1');
      service.recordActivity('g1', 'u1');

      const mq = service.getMemberQuest('g1', 'u1', 'timed');
      assert.strictEqual(mq.status, StatusExpired);
      assert.strictEqual(mq.progress, 1);

      const p = profile.getProfile(null, 'g1', 'u1');
      assert.strictEqual(p.xp, 0);

      db.close();
    });
  });

  describe('Isolation', () => {
    it('guilds and users are isolated', () => {
      ensureProfile(harness.profile, harness.service, 'g1', 'u1', 'user1');
      ensureProfile(harness.profile, harness.service, 'g1', 'u2', 'user2');
      ensureProfile(harness.profile, harness.service, 'g2', 'u1', 'user1');

      for (let i = 0; i < 5; i++) {
        harness.service.recordActivity('g1', 'u1');
      }

      const g1u1 = harness.service.getMemberQuests('g1', 'u1');
      assert.strictEqual(findQuest(g1u1, 'social_presence').progress, 5);

      const g1u2 = harness.service.getMemberQuests('g1', 'u2');
      assert.strictEqual(findQuest(g1u2, 'social_presence').progress, 0);

      const g2u1 = harness.service.getMemberQuests('g2', 'u1');
      assert.strictEqual(findQuest(g2u1, 'social_presence').progress, 0);
    });
  });

  describe('Persistence', () => {
    it('survives reopen', () => {
      const dbPath = path.join(os.tmpdir(), `nexa_persist_${Date.now()}_${Math.random()}.db`);

      {
        const db = new Database(dbPath);
        migrate(db);
        const profile = new ProfileRepository(db);
        const questRepo = new QuestRepository(db);
        const service = new QuestService(questRepo, profile);
        service.setNow(() => new Date());

        ensureProfile(profile, service, 'g1', 'u1', 'user1');
        service.recordActivity('g1', 'u1');
        service.recordActivity('g1', 'u1');
        service.recordActivity('g1', 'u1');
        db.close();
      }

      {
        const db = new Database(dbPath);
        migrate(db);
        const profile = new ProfileRepository(db);
        const questRepo = new QuestRepository(db);
        const service = new QuestService(questRepo, profile);
        service.setNow(() => new Date());

        const list = service.getMemberQuests('g1', 'u1');
        assert.strictEqual(findQuest(list, 'first_steps').status, StatusCompleted);
        assert.strictEqual(findQuest(list, 'social_presence').progress, 3);
        db.close();
      }
    });
  });

  describe('Concurrency', () => {
    it('handles concurrent activity without duplicate rewards', () => {
      const defs = [{
        Key: 'milestone',
        Name: 'Milestone',
        Description: 'Concurrent completion quest.',
        Target: 5,
        XP: 50,
        CollectibleRewardKey: '',
        DurationSeconds: 0
      }];

      const dbPath = path.join(os.tmpdir(), `nexa_concurrent_${Date.now()}_${Math.random()}.db`);
      const db = new Database(dbPath);
      migrate(db);

      const profile = new ProfileRepository(db);
      const questRepo = new QuestRepository(db, defs);
      const service = new QuestService(questRepo, profile);
      service.setNow(() => new Date());

      ensureProfile(profile, service, 'g1', 'u1', 'user1');

      const workers = 12;
      const promises = [];
      for (let i = 0; i < workers; i++) {
        promises.push(Promise.resolve(service.recordActivity('g1', 'u1')));
      }
      Promise.all(promises).catch(e => {});

      const mq = service.getMemberQuest('g1', 'u1', 'milestone');
      assert.strictEqual(mq.progress, 5);
      assert.strictEqual(mq.status, StatusCompleted);
      assert.ok(mq.rewardClaimed);

      const p = profile.getProfile(null, 'g1', 'u1');
      assert.strictEqual(p.xp, 50);

      db.close();
    });
  });

  describe('Model', () => {
    it('formats progress text correctly', () => {
      const { memberQuestProgressText, createMemberQuest } = require('../src/quests/model');

      const mq1 = createMemberQuest(1, 'g1', 'u1', 1, 'test', 'Test', 'desc', 'message_count', 1, 10, 0, 'active', new Date(), null, null, false);
      assert.strictEqual(memberQuestProgressText(mq1), 'Send 1 message');

      const mq5 = createMemberQuest(2, 'g1', 'u1', 2, 'test', 'Test', 'desc', 'message_count', 5, 25, 0, 'active', new Date(), null, null, false);
      assert.strictEqual(memberQuestProgressText(mq5), 'Send 5 messages');

      const mqUnknown = createMemberQuest(3, 'g1', 'u1', 3, 'test', 'Test', 'desc', 'unknown', 5, 25, 0, 'active', new Date(), null, null, false);
      assert.strictEqual(memberQuestProgressText(mqUnknown), '');
    });
  });
});