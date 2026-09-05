const { ModerationRepository } = require('./repository');

class ModerationService {
  constructor(modRepo) {
    this.repo = modRepo;
  }

  warn(guildID, userID, moderatorID, moderatorName, reason) {
    if (!guildID || !userID || !moderatorID) {
      throw new Error('guild id, user id, and moderator id are required');
    }
    this.repo.addWarning(guildID, userID, moderatorID, moderatorName, reason);
  }

  warnings(guildID, userID) {
    if (!guildID || !userID) {
      throw new Error('guild id and user id are required');
    }
    return this.repo.getWarnings(guildID, userID);
  }

  guildWarnings(guildID, limit = 100) {
    if (!guildID) {
      throw new Error('guild id is required');
    }
    return this.repo.getGuildWarnings(guildID, limit);
  }
}

module.exports = { ModerationService };