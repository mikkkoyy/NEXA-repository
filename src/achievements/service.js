const { AchievementRepository } = require('./repository');

class AchievementService {
  constructor(achievementRepo, profileRepo, nowFn) {
    this.repo = achievementRepo;
    this.profile = profileRepo;
    this.now = nowFn || (() => new Date());
  }

  setNow(fn) {
    this.now = fn;
  }

  ensureAchievementAccess(guildID, userID) {
    if (!guildID || !userID) {
      throw new Error('guild id and user id are required');
    }
    const now = this.now();
    this.repo.ensureGuildAchievements(guildID, now);
    this.repo.ensureMemberAchievements(guildID, userID, now);
  }

  getMemberAchievements(guildID, userID) {
    this.ensureAchievementAccess(guildID, userID);
    return this.repo.getMemberAchievements(guildID, userID, this.now());
  }

  getMemberAchievement(guildID, userID, key) {
    this.ensureAchievementAccess(guildID, userID);
    return this.repo.getMemberAchievement(guildID, userID, key, this.now());
  }

  recordActivity(guildID, userID) {
    if (!guildID || !userID) {
      throw new Error('guild id and user id are required');
    }
    const now = this.now();

    const db = this.repo.db.db;

    const tx = db.transaction(() => {
      const completed = this.repo.processActivityTx(guildID, userID, now);
      for (const ma of completed) {
        // Award XP reward if configured
        if (ma.rewardXP > 0) {
          this.profile.addXPTx(null, guildID, userID, ma.rewardXP, now);
        }
      }
      return completed;
    });

    return tx();
  }
}

module.exports = { AchievementService };