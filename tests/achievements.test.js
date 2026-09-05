const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const os = require('os');

const Database = require('../src/database/database');
const { migrate } = require('../src/database/schema');
const { ProfileRepository } = require('../src/identity/repository');
const { AchievementRepository } = require('../src/achievements/repository');
const { AchievementService } = require('../src/achievements/service');
const { DefaultAchievements, ObjectiveMessageCount } = require('../src/achievements/seed');
const { StatusAvailable, StatusActive, StatusCompleted } = require('../src/achievements/model');

function createTestHarness() {
  const dbPath = path.join(os.tmpdir(), `nexa_achievements_${Date.now()}_${Math.random()}.db`);
  const db = new Database(dbPath);
  migrate(db);

  const profile = new ProfileRepository(db);
  const achievementRepo = new AchievementRepository(db);
  const service = new AchievementService(achievementRepo, profile);

  let current = new Date('2026-09-04T12:00:00Z');
  service.setNow(() => current);
  achievementRepo._now = () => current;
  profile._now = () => current;

  const advance = (d) => { current = new Date(current.getTime() + d); };

  return { db, profile, achievementRepo, service, advance, current: () => current };
}

function ensureProfile(profile, service, guildID, userID, name) {
  profile.ensureProfile(null, guildID, userID, name, name, service.now());
}

function findAchievement(list, key) {
  return list.find(ma => ma.key === key);
}

describe('Achievements Engine', () => {
  let harness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  afterEach(() => {
    harness.db.close();
  });

  describe('Seed', () => {
    it('creates default achievements', () => {
      harness.service.ensureAchievementAccess('g1', 'u1');
      const rows = harness.db.db.prepare('SELECT COUNT(*) as cnt FROM achievements WHERE guild_id = ?').get('g1');
      assert.strictEqual(rows.cnt, DefaultAchievements().length);
    });

    it('is idempotent', () => {
      harness.service.ensureAchievementAccess('g1', 'u1');
      harness.service.ensureAchievementAccess('g1', 'u1');
      const rows = harness.db.db.prepare('SELECT COUNT(*) as cnt FROM achievements WHERE guild_id = ?').get('g1');
      assert.strictEqual(rows.cnt, DefaultAchievements().length);
    });

    it('has correct default achievements', () => {
      const defs = DefaultAchievements();
      assert.strictEqual(defs.length, 3);
      const keys = defs.map(d => d.Key);
      assert.ok(keys.includes('first_steps'));
      assert.ok(keys.includes('social_presence'));
      assert.ok(keys.includes('regular'));
    });

    it('first_steps has correct metadata', () => {
      const defs = DefaultAchievements();
      const fs = defs.find(d => d.Key === 'first_steps');
      assert.strictEqual(fs.Name, 'First Steps');
      assert.strictEqual(fs.Description, 'Send your first message and begin your journey.');
      assert.strictEqual(fs.ObjectiveType, 'message_count');
      assert.strictEqual(fs.Target, 1);
      assert.strictEqual(fs.RewardXP, 10);
    });

    it('social_presence has correct metadata', () => {
      const defs = DefaultAchievements();
      const sp = defs.find(d => d.Key === 'social_presence');
      assert.strictEqual(sp.Name, 'Social Presence');
      assert.strictEqual(sp.Description, 'Become an active presence in the server.');
      assert.strictEqual(sp.ObjectiveType, 'message_count');
      assert.strictEqual(sp.Target, 5);
      assert.strictEqual(sp.RewardXP, 25);
    });

    it('regular has correct metadata', () => {
      const defs = DefaultAchievements();
      const reg = defs.find(d => d.Key === 'regular');
      assert.strictEqual(reg.Name, 'Regular');
      assert.strictEqual(reg.Description, 'Keep the conversation alive.');
      assert.strictEqual(reg.ObjectiveType, 'message_count');
      assert.strictEqual(reg.Target, 10);
      assert.strictEqual(reg.RewardXP, 50);
    });
  });

  describe('Assignment', () => {
    it('assigns achievements to member', () => {
      harness.service.ensureAchievementAccess('g1', 'u1');
      const rows = harness.db.db.prepare('SELECT COUNT(*) as cnt FROM member_achievements WHERE guild_id = ? AND user_id = ?').get('g1', 'u1');
      assert.strictEqual(rows.cnt, DefaultAchievements().length);
    });

    it('is idempotent for member', () => {
      harness.service.ensureAchievementAccess('g1', 'u1');
      harness.service.ensureAchievementAccess('g1', 'u1');
      const rows = harness.db.db.prepare('SELECT COUNT(*) as cnt FROM member_achievements WHERE guild_id = ? AND user_id = ?').get('g1', 'u1');
      assert.strictEqual(rows.cnt, DefaultAchievements().length);
    });
  });

  describe('Progress', () => {
    it('first message completes first_steps achievement', () => {
      ensureProfile(harness.profile, harness.service, 'g1', 'u1', 'user1');
      harness.service.recordActivity('g1', 'u1');

      const list = harness.service.getMemberAchievements('g1', 'u1');
      const mq = findAchievement(list, 'first_steps');
      assert.ok(mq);
      assert.strictEqual(mq.progress, 1);
      assert.strictEqual(mq.status, StatusCompleted);
    });

    it('advances to target and stops', () => {
      ensureProfile(harness.profile, harness.service, 'g1', 'u1', 'user1');

      for (let i = 0; i < 6; i++) {
        harness.service.recordActivity('g1', 'u1');
      }

      const list = harness.service.getMemberAchievements('g1', 'u1');
      const social = findAchievement(list, 'social_presence');
      assert.ok(social);
      assert.strictEqual(social.progress, 5);
      assert.strictEqual(social.status, StatusCompleted);
    });

    it('does not progress after completion', () => {
      ensureProfile(harness.profile, harness.service, 'g1', 'u1', 'user1');

      for (let i = 0; i < 6; i++) {
        harness.service.recordActivity('g1', 'u1');
      }

      const list = harness.service.getMemberAchievements('g1', 'u1');
      const social = findAchievement(list, 'social_presence');
      assert.strictEqual(social.progress, 5);
      assert.strictEqual(social.status, StatusCompleted);

      harness.service.recordActivity('g1', 'u1');
      const list2 = harness.service.getMemberAchievements('g1', 'u1');
      const social2 = findAchievement(list2, 'social_presence');
      assert.strictEqual(social2.progress, 5);
      assert.strictEqual(social2.status, StatusCompleted);
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
      assert.strictEqual(p.xp, 35); // first_steps (10) + social_presence (25) = 35
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

      const g1u1 = harness.service.getMemberAchievements('g1', 'u1');
      assert.strictEqual(findAchievement(g1u1, 'social_presence').progress, 5);
      assert.strictEqual(findAchievement(g1u1, 'social_presence').status, StatusCompleted);

      const g1u2 = harness.service.getMemberAchievements('g1', 'u2');
      assert.strictEqual(findAchievement(g1u2, 'social_presence').progress, 0);
      assert.strictEqual(findAchievement(g1u2, 'social_presence').status, StatusAvailable);

      const g2u1 = harness.service.getMemberAchievements('g2', 'u1');
      assert.strictEqual(findAchievement(g2u1, 'social_presence').progress, 0);
      assert.strictEqual(findAchievement(g2u1, 'social_presence').status, StatusAvailable);
    });
  });

  describe('Persistence', () => {
    it('survives reopen', () => {
      const dbPath = path.join(os.tmpdir(), `nexa_achievements_persist_${Date.now()}_${Math.random()}.db`);

      {
        const db = new Database(dbPath);
        migrate(db);
        const profile = new ProfileRepository(db);
        const achievementRepo = new AchievementRepository(db);
        const service = new AchievementService(achievementRepo, profile);
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
        const achievementRepo = new AchievementRepository(db);
        const service = new AchievementService(achievementRepo, profile);
        service.setNow(() => new Date());

        const list = service.getMemberAchievements('g1', 'u1');
        assert.strictEqual(findAchievement(list, 'first_steps').status, StatusCompleted);
        assert.strictEqual(findAchievement(list, 'social_presence').progress, 3);
        assert.strictEqual(findAchievement(list, 'social_presence').status, StatusActive);
        db.close();
      }
    });
  });

  describe('Concurrency', () => {
    it('handles concurrent activity without duplicate rewards', () => {
      const defs = [{
        Key: 'milestone',
        Name: 'Milestone',
        Description: 'Concurrent completion achievement.',
        ObjectiveType: 'message_count',
        Target: 5,
        RewardXP: 50,
        Enabled: true
      }];

      const dbPath = path.join(os.tmpdir(), `nexa_achievements_concurrent_${Date.now()}_${Math.random()}.db`);
      const db = new Database(dbPath);
      migrate(db);

      const profile = new ProfileRepository(db);
      const achievementRepo = new AchievementRepository(db, defs);
      const service = new AchievementService(achievementRepo, profile);
      service.setNow(() => new Date());

      ensureProfile(profile, service, 'g1', 'u1', 'user1');

      const workers = 12;
      const promises = [];
      for (let i = 0; i < workers; i++) {
        promises.push(Promise.resolve(service.recordActivity('g1', 'u1')));
      }
      Promise.all(promises).catch(e => {});

      const ma = service.getMemberAchievement('g1', 'u1', 'milestone');
      assert.strictEqual(ma.progress, 5);
      assert.strictEqual(ma.status, StatusCompleted);

      const p = profile.getProfile(null, 'g1', 'u1');
      assert.strictEqual(p.xp, 50);

      db.close();
    });
  });

  describe('Model', () => {
    it('formats progress text correctly', () => {
      const { memberAchievementProgressText, createMemberAchievement } = require('../src/achievements/model');

      const ma1 = createMemberAchievement(1, 'g1', 'u1', 1, 'test', 'Test', 'desc', 'message_count', 1, 10, 1, 'active', new Date(), null, new Date(), new Date());
      assert.strictEqual(memberAchievementProgressText(ma1), 'Send 1 message');

      const ma5 = createMemberAchievement(2, 'g1', 'u1', 2, 'test', 'Test', 'desc', 'message_count', 5, 25, 5, 'active', new Date(), null, new Date(), new Date());
      assert.strictEqual(memberAchievementProgressText(ma5), 'Send 5 messages');

      const maUnknown = createMemberAchievement(3, 'g1', 'u1', 3, 'test', 'Test', 'desc', 'unknown', 5, 25, 0, 'active', new Date(), null, new Date(), new Date());
      assert.strictEqual(memberAchievementProgressText(maUnknown), '');
    });
  });

  describe('Service Integration', () => {
    it('hasCollectible works', () => {
      harness.service.ensureAchievementAccess('g1', 'u1');
      const ma = harness.service.getMemberAchievement('g1', 'u1', 'first_steps');
      assert.strictEqual(ma.progress, 0);
      assert.strictEqual(ma.status, StatusAvailable);

      harness.service.recordActivity('g1', 'u1');
      const ma2 = harness.service.getMemberAchievement('g1', 'u1', 'first_steps');
      assert.strictEqual(ma2.progress, 1);
      assert.strictEqual(ma2.status, StatusCompleted);

      // Test hasCollectible-like function for achievements
      const completedAch = harness.service.getMemberAchievements('g1', 'u1').find(a => a.status === StatusCompleted);
      assert.ok(completedAch);
    });
  });
});