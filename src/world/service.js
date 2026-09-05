const { WorldRepository } = require('./repository');

class WorldService {
  constructor(worldRepo, nowFn) {
    this.repo = worldRepo;
    this.now = nowFn || (() => new Date());
  }

  setNow(fn) {
    this.now = fn;
  }

  recordMessage(guildID) {
    if (!guildID) {
      throw new Error('guild id is required');
    }
    this.repo.ensureGuildWorld(guildID, this.now());
  }

  getWorldState(guildID) {
    if (!guildID) {
      return null;
    }
    return this.repo.getWorldState(guildID);
  }
}

module.exports = { WorldService };