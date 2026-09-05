class CreatorContentService {
  constructor(contentRepo) {
    this.repo = contentRepo;
  }

  hasCreatorProfile(guildId, userId) {
    const creator = this.repo.db.get(
      'SELECT id, guild_id, user_id, display_name, status, created_at, updated_at FROM creator_profiles WHERE guild_id = ? AND user_id = ?',
      [guildId, userId]
    );
    return creator !== null;
  }

  isCreatorActive(guildId, userId) {
    const creator = this.repo.db.get(
      'SELECT id, guild_id, user_id, display_name, status, created_at, updated_at FROM creator_profiles WHERE guild_id = ? AND user_id = ?',
      [guildId, userId]
    );
    return creator !== null && creator.status === 'active';
  }

  async createContent(guildId, userId, title, description, contentType = 'text') {
    if (!this.isCreatorActive(guildId, userId)) {
      return {
        success: false,
        error: 'NOT_CREATOR_OR_SUSPENDED',
        message: 'Only active creators can create content. Use /creator register to become one.',
      };
    }

    // Get the creator profile ID
    const creator = this.repo.db.get(
      'SELECT id FROM creator_profiles WHERE guild_id = ? AND user_id = ?',
      [guildId, userId]
    );
    const creatorId = creator.id;

    const createResult = this.repo.createContent(guildId, creatorId, title, description, contentType);

    if (createResult.duplicate) {
      return {
        success: false,
        error: 'CONTENT_TITLE_EXISTS',
        message: 'You already have content with that title. Please use a different title.',
        content: createResult.content,
      };
    }

    return {
      success: true,
      content: createResult.content,
      message: 'Content created as draft.',
    };
  }

  getContent(guildId, contentId) {
    return this.repo.getContent(guildId, contentId);
  }

  getCreatorContent(guildId, userId) {
    const creatorContent = this.repo.getCreatorContent(guildId, userId);
    return { success: true, content: creatorContent };
  }

  publishContent(guildId, userId, contentId) {
    if (!this.isCreatorActive(guildId, userId)) {
      return {
        success: false,
        error: 'NOT_ACTIVE_CREATOR',
        message: 'Only active creators can publish content.',
      };
    }

    // Get the creator profile ID
    const creator = this.repo.db.get(
      'SELECT id FROM creator_profiles WHERE guild_id = ? AND user_id = ?',
      [guildId, userId]
    );
    const creatorId = creator.id;

    const content = this.repo.getContent(guildId, contentId);

    if (!content) {
      return {
        success: false,
        error: 'CONTENT_NOT_FOUND',
        message: 'Content not found.',
      };
    }

    if (content.creatorId !== creatorId) {
      return {
        success: false,
        error: 'NOT_CONTENT_OWNER',
        message: 'You do not own this content.',
      };
    }

    const publishResult = this.repo.publishContent(guildId, contentId);

    if (publishResult.alreadyPublished) {
      return {
        success: false,
        error: 'ALREADY_PUBLISHED',
        message: 'This content is already published.',
        content: publishResult.content,
      };
    }

    return {
      success: true,
      content: publishResult.content,
      message: 'Content published successfully.',
    };
  }

  unpublishContent(guildId, userId, contentId) {
    if (!this.isCreatorActive(guildId, userId)) {
      return {
        success: false,
        error: 'NOT_ACTIVE_CREATOR',
        message: 'Only active creators can unpublish content.',
      };
    }

    // Get the creator profile ID
    const creator = this.repo.db.get(
      'SELECT id FROM creator_profiles WHERE guild_id = ? AND user_id = ?',
      [guildId, userId]
    );
    const creatorId = creator.id;

    const content = this.repo.getContent(guildId, contentId);

    if (!content) {
      return {
        success: false,
        error: 'CONTENT_NOT_FOUND',
        message: 'Content not found.',
      };
    }

    if (content.creatorId !== creatorId) {
      return {
        success: false,
        error: 'NOT_CONTENT_OWNER',
        message: 'You do not own this content.',
      };
    }

    if (!content) {
      return {
        success: false,
        error: 'CONTENT_NOT_FOUND',
        message: 'Content not found.',
      };
    }

    if (content.creatorId !== creatorId) {
      return {
        success: false,
        error: 'NOT_CONTENT_OWNER',
        message: 'You do not own this content.',
      };
    }

    const unpublishResult = this.repo.unpublishContent(guildId, contentId);

    if (unpublishResult.alreadyDraft) {
      return {
        success: false,
        error: 'ALREADY_DRAFT',
        message: 'This content is already a draft.',
        content: unpublishResult.content,
      };
    }

    return {
      success: true,
      content: unpublishResult.content,
      message: 'Content unpublished successfully.',
    };
  }

  deleteContent(guildId, userId, contentId) {
    if (!this.isCreatorActive(guildId, userId)) {
      return {
        success: false,
        error: 'NOT_ACTIVE_CREATOR',
        message: 'Only active creators can delete content.',
      };
    }

    // Get the creator profile ID
    const creator = this.repo.db.get(
      'SELECT id FROM creator_profiles WHERE guild_id = ? AND user_id = ?',
      [guildId, userId]
    );
    const creatorId = creator.id;

    const content = this.repo.getContent(guildId, contentId);

    if (!content) {
      return {
        success: false,
        error: 'CONTENT_NOT_FOUND',
        message: 'Content not found.',
      };
    }

    if (content.creatorId !== creatorId) {
      return {
        success: false,
        error: 'NOT_CONTENT_OWNER',
        message: 'You do not own this content.',
      };
    }

    const deleteResult = this.repo.deleteContent(guildId, contentId);

    if (deleteResult.notFound) {
      return {
        success: false,
        error: 'CONTENT_NOT_FOUND',
        message: 'Content not found.',
      };
    }

    return {
      success: true,
      message: 'Content deleted.',
    };
  }
}

module.exports = { CreatorContentService };