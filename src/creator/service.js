const Database = require('../database/database');

class CreatorService {
  constructor(creatorRepo) {
    this.repo = creatorRepo;
  }

  registerCreator(guildId, userId, displayName) {
    const now = new Date().toISOString();

    if (!this.hasMemberProfile(guildId, userId)) {
      return {
        success: false,
        error: 'USER_HAS_NO_MEMBER_PROFILE',
        message: 'You must have a NEXA member profile to become a creator. Use /profile to register first.',
      };
    }

    const createResult = this.repo.createCreator(guildId, userId, displayName, 'active');

    if (createResult.duplicate) {
      return {
        success: false,
        error: 'ALREADY_REGISTERED',
        creator: createResult.creator,
        message: 'You are already registered as a creator.',
      };
    }

    return {
      success: true,
      creator: createResult.creator,
      message: 'You are now an active creator!',
    };
  }

  getCreator(guildId, userId) {
    return this.repo.getCreator(guildId, userId);
  }

  isCreator(guildId, userId) {
    const creator = this.repo.getCreator(guildId, userId);
    return creator !== null && creator.status === 'active';
  }

  setCreatorStatus(guildId, userId, status) {
    if (status !== 'pending' && status !== 'active' && status !== 'suspended') {
      throw new Error('Invalid creator status: ' + status);
    }

    const result = this.repo.updateCreatorStatus(guildId, userId, status);
    return result;
  }

  hasMemberProfile(guildId, userId) {
    const row = this.repo.db.db.prepare(
      'SELECT id FROM member_profiles WHERE guild_id = ? AND user_id = ?'
    ).get(guildId, userId);
    return !!row;
  }
}

module.exports = { CreatorService };