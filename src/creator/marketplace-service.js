const { CreatorMarketplaceRepository } = require('../creator/marketplace-repository');
const { resolveCreator, resolveCreatorProfileId } = require('./resolver');

class CreatorMarketplaceService {
  constructor(marketplaceRepo) {
    this.repo = marketplaceRepo;
  }

  async createProduct(guildId, userId, contentId, priceMinor, currency) {
    // Check creator exists and is active via the repo's database
    const creator = resolveCreator(this.repo.db, guildId, userId);

    if (!creator) {
      return {
        success: false,
        error: 'NOT_CREATOR',
        message: 'You must be an active creator to create marketplace products.',
      };
    }

    if (creator.status !== 'active') {
      return {
        success: false,
        error: 'CREATOR_SUSPENDED',
        message: 'Suspended creators cannot create marketplace products.',
      };
    }

    // Check content exists and belongs to creator
    const content = this.repo.db.get(
      'SELECT id, guild_id, creator_id, title, description, content_type, status, created_at, updated_at, published_at FROM creator_content WHERE guild_id = ? AND creator_id = ? AND id = ?',
      [guildId, creator.id, contentId]
    );

    if (!content) {
      return {
        success: false,
        error: 'CONTENT_NOT_FOUND',
        message: 'Content not found.',
      };
    }

    if (content.creator_id !== creator.id) {
      return {
        success: false,
        error: 'CONTENT_NOT_OWNED',
        message: 'You do not own this content.',
      };
    }

    // Check content is published
    if (content.status !== 'published') {
      return {
        success: false,
        error: 'CONTENT_NOT_PUBLISHED',
        message: 'Only published content can be listed on the marketplace.',
      };
    }

    const createResult = this.repo.createCreatorProduct(guildId, creator.id, contentId, priceMinor, currency);

    if (createResult.duplicate) {
      return {
        success: false,
        error: 'PRODUCT_EXISTS',
        message: 'You already have a marketplace product for this content.',
        product: createResult.product,
      };
    }

    return {
      success: true,
      product: createResult.product,
      message: 'Marketplace product created as unlisted.',
    };
  }

  getProduct(guildId, productId) {
    return this.repo.getCreatorProduct(guildId, productId);
  }

  listProduct(guildId, productId, userId) {
    const creatorId = resolveCreatorProfileId(this.repo.db, guildId, userId);
    if (!creatorId) {
      return {
        success: false,
        error: 'NOT_CREATOR',
        message: 'You must be an active creator to manage products.',
      };
    }

    const result = this.repo.listCreatorProduct(guildId, productId, creatorId);

    if (result.notFound) {
      return {
        success: false,
        error: 'PRODUCT_NOT_FOUND',
        message: 'Product not found.',
      };
    }

    if (result.notOwner) {
      return {
        success: false,
        error: 'NOT_PRODUCT_OWNER',
        message: 'You do not own this product.',
      };
    }

    if (result.alreadyListed) {
      return {
        success: false,
        error: 'ALREADY_LISTED',
        message: 'This product is already listed on the marketplace.',
      };
    }

    return {
      success: true,
      product: result.product,
      message: 'Product listed successfully.',
    };
  }

  unlistProduct(guildId, productId, userId) {
    const creatorId = resolveCreatorProfileId(this.repo.db, guildId, userId);
    if (!creatorId) {
      return {
        success: false,
        error: 'NOT_CREATOR',
        message: 'You must be an active creator to manage products.',
      };
    }

    const result = this.repo.unlistCreatorProduct(guildId, productId, creatorId);

    if (result.notFound) {
      return {
        success: false,
        error: 'PRODUCT_NOT_FOUND',
        message: 'Product not found.',
      };
    }

    if (result.notOwner) {
      return {
        success: false,
        error: 'NOT_PRODUCT_OWNER',
        message: 'You do not own this product.',
      };
    }

    if (result.alreadyUnlisted) {
      return {
        success: false,
        error: 'ALREADY_UNLISTED',
        message: 'This product is already unlisted.',
      };
    }

    return {
      success: true,
      product: result.product,
      message: 'Product unlisted successfully.',
    };
  }

  getCreatorProducts(guildId, userId) {
    const creatorId = resolveCreatorProfileId(this.repo.db, guildId, userId);
    if (!creatorId) {
      return { success: false, error: 'NOT_CREATOR', products: [] };
    }
    const products = this.repo.getCreatorProducts(guildId, creatorId);
    return { success: true, products };
  }
}

module.exports = { CreatorMarketplaceService };