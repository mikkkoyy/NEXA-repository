const { ProfileRepository, levelForXP, xpForLevel } = require('./repository');
const { economy } = require('../config/economy');

const MessageXP = 2;
const MessageCooldown = 60 * 1000;
const rewardCacheLimit = 10000;

class IdentityService {
  constructor(repo) {
    this.repo = repo;
    this.rewardXP = MessageXP;
    this.cooldown = MessageCooldown;
    this.now = () => new Date();
    this.lastRewards = new Map();
    this.mu = { locked: false, queue: [] };
    this.premiumService = null;
  }

  setNow(fn) {
    this.now = fn;
  }

  setPremiumService(premiumService) {
    this.premiumService = premiumService;
  }

  isPremium(guildID, userID) {
    return !!(this.premiumService && this.premiumService.isPremium(guildID, userID));
  }

  profile(ctx, guildID, userID, username, displayName) {
    this.repo.ensureProfile(ctx, guildID, userID, username, displayName, this.now());
    return this.repo.getProfile(ctx, guildID, userID);
  }

  async recordMessage(ctx, guildID, userID, username, displayName) {
    let reward = this.takeReward(ctx, guildID, userID);
    if (reward > 0 && this.isPremium(guildID, userID)) {
      reward = Math.ceil(reward * economy.premiumBenefits.xpMultiplier);
    }
    this.repo.recordActivity(ctx, guildID, userID, username, displayName, reward, this.now());
  }

  takeReward(ctx, guildID, userID) {
    const key = guildID + ':' + userID;
    const now = this.now();

    if (this.lastRewards.size > rewardCacheLimit) {
      let toDelete = [];
      for (const [cached, last] of this.lastRewards) {
        if (now - last >= this.cooldown) {
          toDelete.push(cached);
        }
      }
      for (const cached of toDelete) {
        this.lastRewards.delete(cached);
      }
    }

    const last = this.lastRewards.get(key);
    if (last !== undefined && now - last < this.cooldown) {
      return 0;
    }
    this.lastRewards.set(key, now);
    return this.rewardXP;
  }

  addReputation(ctx, guildID, userID, delta) {
    if (delta > 0 && this.isPremium(guildID, userID)) {
      delta = Math.ceil(delta * economy.premiumBenefits.reputationMultiplier);
    }
    const ts = this.now().toISOString();
    const stmt = this.repo.db.db.prepare(
      'UPDATE member_profiles SET reputation = reputation + ?, updated_at = ? WHERE guild_id = ? AND user_id = ?'
    );
    const result = stmt.run(delta, ts, guildID, userID);
    return result.changes > 0;
  }

  async addXP(ctx, guildID, userID, delta) {
    if (delta === 0) return;
    const row = this.repo.getMemberProfileData(ctx, guildID, userID);
    if (!row) return;
    const newXP = row.xp + delta;
    const newLevel = levelForXP(newXP);
    this.repo.db.exec(
      'UPDATE member_profiles SET xp = ?, level = ?, updated_at = ? WHERE guild_id = ? AND user_id = ?',
      [newXP, newLevel, this.now().toISOString(), guildID, userID]
    );
  }
}

module.exports = IdentityService;