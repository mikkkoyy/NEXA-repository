const { resolveCreator, resolveCreatorProfileId } = require('./resolver');

class CreatorContentService {
  constructor(contentRepo) {
    this.repo = contentRepo;
  }

  hasCreatorProfile(guildId, userId) {
    return resolveCreator(this.repo.db, guildId, userId) !== null;
  }

  isCreatorActive(guildId, userId) {
    const creator = resolveCreator(this.repo.db, guildId, userId);
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

    // Translate the Discord user ID into the canonical creator profile ID
    const creatorId = resolveCreatorProfileId(this.repo.db, guildId, userId);

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
    const creatorId = resolveCreatorProfileId(this.repo.db, guildId, userId);
    if (!creatorId) {
      return { success: false, error: 'NOT_CREATOR', message: 'You are not registered as a creator.' };
    }
    const creatorContent = this.repo.getCreatorContent(guildId, creatorId);
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

    // Translate the Discord user ID into the canonical creator profile ID
    const creatorId = resolveCreatorProfileId(this.repo.db, guildId, userId);

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

    // Translate the Discord user ID into the canonical creator profile ID
    const creatorId = resolveCreatorProfileId(this.repo.db, guildId, userId);

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

  updateContent(guildId, userId, contentId, title, description) {
    if (!this.isCreatorActive(guildId, userId)) {
      return {
        success: false,
        error: 'NOT_ACTIVE_CREATOR',
        message: 'Only active creators can edit content.',
      };
    }

    // Translate the Discord user ID into the canonical creator profile ID
    const creatorId = resolveCreatorProfileId(this.repo.db, guildId, userId);

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

    const updateResult = this.repo.updateContent(guildId, contentId, title, description);

    if (updateResult.notFound) {
      return {
        success: false,
        error: 'CONTENT_NOT_FOUND',
        message: 'Content not found.',
      };
    }

    return {
      success: true,
      content: updateResult.content,
      message: 'Content updated successfully.',
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

    // Translate the Discord user ID into the canonical creator profile ID
    const creatorId = resolveCreatorProfileId(this.repo.db, guildId, userId);

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