const { QuestRepository } = require('./repository');

class QuestService {
  constructor(questRepo, profileRepo, collectibleRepo, nowFn) {
    this.repo = questRepo;
    this.profile = profileRepo;
    this.collectible = collectibleRepo;
    this.now = nowFn || (() => new Date());
  }

  setNow(fn) {
    this.now = fn;
  }

  ensureQuestAccess(guildID, userID) {
    if (!guildID || !userID) {
      throw new Error('guild id and user id are required');
    }
    const now = this.now();
    this.repo.ensureGuildQuests(guildID, now);
    this.repo.ensureMemberQuests(guildID, userID, now);
  }

  getMemberQuests(guildID, userID) {
    this.ensureQuestAccess(guildID, userID);
    return this.repo.getMemberQuests(guildID, userID, this.now());
  }

  getMemberQuest(guildID, userID, key) {
    this.ensureQuestAccess(guildID, userID);
    return this.repo.getMemberQuest(guildID, userID, key, this.now());
  }

  recordActivity(guildID, userID) {
    if (!guildID || !userID) {
      throw new Error('guild id and user id are required');
    }
    const now = this.now();

    const db = this.repo.db.db;

    const tx = db.transaction(() => {
      const completed = this.repo.processActivityTx(guildID, userID, now);
      for (const mq of completed) {
        // Award XP reward
        this.profile.addXPTx(null, guildID, userID, mq.xp, now);

        // Award collectible reward if configured
        if (mq.collectibleRewardKey && this.collectible) {
          this.collectible.grantCollectibleTx(
            guildID, userID, mq.collectibleRewardKey, 'quest', now
          );
        }
      }
      return completed;
    });

    return tx();
  }
}

module.exports = { QuestService };