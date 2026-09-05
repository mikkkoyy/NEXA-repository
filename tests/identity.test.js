const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

function getTestDbPath() {
  return path.join(os.tmpdir(), `nexa_test_${Date.now()}_${Math.random().toString(36).slice(2)}.db`);
}

function createRepo(dbPath) {
  const { ProfileRepository } = require('../src/identity/repository');
  return new ProfileRepository(dbPath);
}

describe('XP System', () => {
  it('should have correct XP threshold for level 1 (0 XP)', () => {
    const { xpForLevel } = require('../src/identity/repository');
    assert.strictEqual(xpForLevel(1), 0);
  });

  it('should have correct XP threshold for level 2 (100 XP)', () => {
    const { xpForLevel } = require('../src/identity/repository');
    assert.strictEqual(xpForLevel(2), 100);
  });

  it('should have correct XP threshold for level 3 (250 XP)', () => {
    const { xpForLevel } = require('../src/identity/repository');
    assert.strictEqual(xpForLevel(3), 250);
  });

  it('should have correct XP threshold for level 4 (450 XP)', () => {
    const { xpForLevel } = require('../src/identity/repository');
    assert.strictEqual(xpForLevel(4), 450);
  });

  it('should have correct XP threshold for level 5 (700 XP)', () => {
    const { xpForLevel } = require('../src/identity/repository');
    assert.strictEqual(xpForLevel(5), 700);
  });
});

describe('Level Calculation', () => {
  it('should return level 1 for 0 XP', () => {
    const { levelForXP } = require('../src/identity/repository');
    assert.strictEqual(levelForXP(0), 1);
  });

  it('should return level 1 for negative XP', () => {
    const { levelForXP } = require('../src/identity/repository');
    assert.strictEqual(levelForXP(-100), 1);
  });

  it('should return level 1 for XP below 100', () => {
    const { levelForXP } = require('../src/identity/repository');
    assert.strictEqual(levelForXP(50), 1);
  });

  it('should return level 2 for XP exactly 100', () => {
    const { levelForXP } = require('../src/identity/repository');
    assert.strictEqual(levelForXP(100), 2);
  });

  it('should return level 2 for XP between 101 and 250', () => {
    const { levelForXP } = require('../src/identity/repository');
    assert.strictEqual(levelForXP(150), 2);
  });

  it('should return level 3 for XP exactly 250', () => {
    const { levelForXP } = require('../src/identity/repository');
    assert.strictEqual(levelForXP(250), 3);
  });

  it('should return level 3 for XP between 251 and 450', () => {
    const { levelForXP } = require('../src/identity/repository');
    assert.strictEqual(levelForXP(350), 3);
  });

  it('should return level 4 for XP exactly 450', () => {
    const { levelForXP } = require('../src/identity/repository');
    assert.strictEqual(levelForXP(450), 4);
  });

  it('should return level 4 for XP between 451 and 700', () => {
    const { levelForXP } = require('../src/identity/repository');
    assert.strictEqual(levelForXP(550), 4);
  });

  it('should return level 5 for XP exactly 700', () => {
    const { levelForXP } = require('../src/identity/repository');
    assert.strictEqual(levelForXP(700), 5);
  });
});

describe('Profile Operations', () => {
  let repo;
  let dbPath;

  beforeEach(() => {
    dbPath = getTestDbPath();
    repo = createRepo(dbPath);
  });

  it('should create profile with default values', () => {
    const now = new Date('2026-09-04T12:00:00Z');

    repo.ensureProfile({}, 'g1', 'u1', 'TestUser', 'TestUser', now);
    const profile = repo.getProfile({}, 'g1', 'u1');

    assert.strictEqual(profile.username, 'TestUser');
    assert.strictEqual(profile.displayName, 'TestUser');
    assert.strictEqual(profile.xp, 0);
    assert.strictEqual(profile.level, 1);
    assert.strictEqual(profile.reputation, 0);
    assert.strictEqual(profile.messageCount, 0);
    assert.strictEqual(profile.guildID, 'g1');
    assert.strictEqual(profile.userID, 'u1');
  });

  it('should return null for non-existent profile', () => {
    const profile = repo.getProfile({}, 'g1', 'u1');
    assert.strictEqual(profile, null);
  });

  it('should update profile name on re-ensure', () => {
    const now = new Date('2026-09-04T12:00:00Z');

    repo.ensureProfile({}, 'g1', 'u1', 'OldName', 'OldName', now);
    repo.ensureProfile({}, 'g1', 'u1', 'NewName', 'NewName', now);
    const profile = repo.getProfile({}, 'g1', 'u1');

    assert.strictEqual(profile.username, 'NewName');
    assert.strictEqual(profile.displayName, 'NewName');
  });
});

describe('Message Activity', () => {
  let repo;
  let dbPath;

  beforeEach(() => {
    dbPath = getTestDbPath();
    repo = createRepo(dbPath);
  });

  it('should increment message count on first message with XP reward', () => {
    const now = new Date('2026-09-04T12:00:00Z');

    repo.recordActivity({}, 'g1', 'u1', 'User', 'User', 2, now);
    const profile = repo.getProfile({}, 'g1', 'u1');

    assert.strictEqual(profile.xp, 2);
    assert.strictEqual(profile.messageCount, 1);
    assert.strictEqual(profile.level, 1);
  });

  it('should increment message count but not XP during cooldown', () => {
    const now = new Date('2026-09-04T12:00:00Z');

    repo.recordActivity({}, 'g1', 'u1', 'User', 'User', 2, now);
    repo.recordActivity({}, 'g1', 'u1', 'User', 'User', 0, now);

    const profile = repo.getProfile({}, 'g1', 'u1');
    assert.strictEqual(profile.xp, 2);
    assert.strictEqual(profile.messageCount, 2);
  });

  it('should update last active timestamp', () => {
    const now = new Date('2026-09-04T12:00:00Z');
    const later = new Date('2026-09-04T12:01:00Z');

    repo.recordActivity({}, 'g1', 'u1', 'User', 'User', 2, now);
    repo.recordActivity({}, 'g1', 'u1', 'User', 'User', 0, later);

    const profile = repo.getProfile({}, 'g1', 'u1');
    assert.ok(profile.lastActiveAt > profile.firstSeenAt);
  });
});

describe('Leveling', () => {
  let repo;
  let dbPath;

  beforeEach(() => {
    dbPath = getTestDbPath();
    repo = createRepo(dbPath);
  });

  it('should level up correctly on XP addition', () => {
    const now = new Date('2026-09-04T12:00:00Z');

    repo.recordActivity({}, 'g1', 'u1', 'User', 'User', 460, now);
    const profile = repo.getProfile({}, 'g1', 'u1');

    assert.strictEqual(profile.xp, 460);
    assert.strictEqual(profile.level, 4);
  });
});

describe('Identity Service', () => {
  let repo;
  let dbPath;

  beforeEach(() => {
    dbPath = getTestDbPath();
    repo = createRepo(dbPath);
  });

  it('should create profile and return it', () => {
    const IdentityService = require('../src/identity/service');
    const service = new IdentityService(repo);
    const now = new Date('2026-09-04T12:00:00Z');

    service.setNow(() => now);
    const profile = service.profile({}, 'g1', 'u1', 'TestUser', 'TestUser');

    assert.strictEqual(profile.username, 'TestUser');
    assert.strictEqual(profile.level, 1);
    assert.strictEqual(profile.xp, 0);
  });

  it('should apply cooldown for rapid messages', () => {
    const IdentityService = require('../src/identity/service');
    const service = new IdentityService(repo);
    const now = new Date('2026-09-04T12:00:00Z');
    const later = new Date('2026-09-04T12:00:01Z');

    service.setNow(() => now);
    service.recordMessage({}, 'g1', 'u1', 'User', 'User');

    service.setNow(() => later);
    service.recordMessage({}, 'g1', 'u1', 'User', 'User');

    const profile = repo.getProfile({}, 'g1', 'u1');
    assert.strictEqual(profile.xp, 2);
    assert.strictEqual(profile.messageCount, 2);
  });

  it('should award XP after cooldown expires', () => {
    const IdentityService = require('../src/identity/service');
    const service = new IdentityService(repo);
    const now = new Date('2026-09-04T12:00:00Z');
    const afterCooldown = new Date('2026-09-04T12:01:01Z');

    service.setNow(() => now);
    service.recordMessage({}, 'g1', 'u1', 'User', 'User');

    service.setNow(() => afterCooldown);
    service.recordMessage({}, 'g1', 'u1', 'User', 'User');

    const profile = repo.getProfile({}, 'g1', 'u1');
    assert.strictEqual(profile.xp, 4);
    assert.strictEqual(profile.messageCount, 2);
  });

  it('should track cooldown per user', () => {
    const IdentityService = require('../src/identity/service');
    const service = new IdentityService(repo);
    const now = new Date('2026-09-04T12:00:00Z');

    service.setNow(() => now);
    service.recordMessage({}, 'g1', 'u1', 'User1', 'User1');
    service.recordMessage({}, 'g1', 'u2', 'User2', 'User2');

    const profile1 = repo.getProfile({}, 'g1', 'u1');
    const profile2 = repo.getProfile({}, 'g1', 'u2');

    assert.strictEqual(profile1.xp, 2);
    assert.strictEqual(profile2.xp, 2);
  });
});