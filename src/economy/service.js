const { EconomyRepository } = require('./repository');

class EconomyService {
  constructor(economyRepo, nowFn) {
    this.repo = economyRepo;
    this.now = nowFn || (() => new Date());
  }

  setNow(fn) {
    this.now = fn;
  }

  ensureWallet(guildID, userID) {
    if (!guildID || !userID) {
      throw new Error('guild id and user id are required');
    }
    return this.repo.ensureWallet(guildID, userID, this.now());
  }

  getBalance(guildID, userID) {
    if (!guildID || !userID) {
      throw new Error('guild id and user id are required');
    }
    this.repo.ensureWallet(guildID, userID, this.now());
    return this.repo.getBalance(guildID, userID);
  }

  getWallet(guildID, userID) {
    if (!guildID || !userID) {
      throw new Error('guild id and user id are required');
    }
    this.repo.ensureWallet(guildID, userID, this.now());
    return this.repo.getWallet(guildID, userID);
  }

  addCurrency(guildID, userID, amount, source, referenceID) {
    const db = this.repo.db.db;
    const tx = db.transaction(() => {
      return this.repo.addBalanceTx(guildID, userID, amount, source, referenceID, this.now());
    });
    return tx();
  }

  spendCurrency(guildID, userID, amount, source, referenceID) {
    const db = this.repo.db.db;
    const tx = db.transaction(() => {
      return this.repo.subtractBalanceTx(guildID, userID, amount, source, referenceID, this.now());
    });
    return tx();
  }

  getTransactions(guildID, userID, limit = 20) {
    if (!guildID || !userID) {
      throw new Error('guild id and user id are required');
    }
    this.repo.ensureWallet(guildID, userID, this.now());
    return this.repo.getTransactions(guildID, userID, limit);
  }
}

module.exports = { EconomyService };