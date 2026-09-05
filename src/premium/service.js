const { PremiumRepository } = require('./repository');

class PremiumService {
  constructor(premiumRepo, testMode) {
    this.repo = premiumRepo;
    this.testMode = testMode || false;
  }

  setTestMode(enabled) {
    this.testMode = enabled;
  }

  getPlan(guildID, key) {
    if (!guildID) {
      return null;
    }
    return this.repo.getPlan(guildID, key || PlanKeyPremium);
  }

  getGuildPremium(guildID) {
    if (!guildID) {
      return null;
    }
    return this.repo.getGuildPremium(guildID);
  }

  isPremium(guildID) {
    if (!guildID) {
      return false;
    }
    return this.repo.isPremium(guildID);
  }

  activatePremium(guildID, planKey, durationDays) {
    if (!guildID) {
      return null;
    }
    if (!planKey) {
      return null;
    }
    if (!this.testMode && !this.testMode) {
      // In production, premium activation requires payment
      // This is a placeholder - real implementation would integrate with payments
      return { error: 'Premium activation requires verified payment in production' };
    }
    if (this.testMode) {
      return this.repo.activateTestPremium(guildID, durationDays);
    }
    return this.repo.activatePremiumTx(guildID, planKey, durationDays, new Date());
  }
}

module.exports = { PremiumService };