const { AnalyticsRepository } = require('./repository');

class AnalyticsService {
  constructor(analyticsRepo, nowFn) {
    this.repo = analyticsRepo;
    this.now = nowFn || (() => new Date());
  }

  setNow(fn) {
    this.now = fn;
  }

  recordMessage(guildID, userID) {
    if (!guildID || !userID) {
      throw new Error('guild id and user id are required');
    }
    this.repo.incrementDay(guildID, userID);
  }

  getServerSummary(guildID, limit = 10) {
    if (!guildID) {
      return null;
    }
    return this.repo.getServerSummary(guildID, limit);
  }

  getDailyActivity(guildID, limit = 10) {
    if (!guildID) {
      return null;
    }
    return this.repo.getDailyActivity(guildID, limit);
  }
}

module.exports = { AnalyticsService };