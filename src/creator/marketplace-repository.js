const Database = require('../database/database');

class CreatorMarketplaceRepository {
  constructor(db) {
    this.db = db;
  }

  ensureSchema() {
    // Schema is already ensured via shared migration, but content_id foreign key enforcement
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS creator_marketplace (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        creator_id INTEGER NOT NULL,
        content_id INTEGER NOT NULL,
        price_minor INTEGER NOT NULL,
        currency TEXT NOT NULL,
        listing_status TEXT NOT NULL DEFAULT 'unlisted',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(guild_id, creator_id, content_id)
      )
    `);
  }

  createCreatorProduct(guildId, creatorId, contentId, priceMinor, currency) {
    const now = new Date().toISOString();

    const existing = this.db.get(
      'SELECT id, guild_id, creator_id, content_id, price_minor, currency, listing_status, created_at, updated_at FROM creator_marketplace WHERE guild_id = ? AND creator_id = ? AND content_id = ?',
      [guildId, creatorId, contentId]
    );

    if (existing) {
      return { duplicate: true, product: this.mapRow(existing) };
    }

    this.db.exec(
      `INSERT INTO creator_marketplace
        (guild_id, creator_id, content_id, price_minor, currency, listing_status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [guildId, creatorId, contentId, priceMinor, currency, 'unlisted', now, now]
    );

    const row = this.db.get(
      'SELECT id, guild_id, creator_id, content_id, price_minor, currency, listing_status, created_at, updated_at FROM creator_marketplace WHERE guild_id = ? AND creator_id = ? AND content_id = ?',
      [guildId, creatorId, contentId]
    );

    return { duplicate: false, product: this.mapRow(row) };
  }

  getCreatorProduct(guildId, productId) {
    const row = this.db.get(
      'SELECT id, guild_id, creator_id, content_id, price_minor, currency, listing_status, created_at, updated_at FROM creator_marketplace WHERE guild_id = ? AND id = ?',
      [guildId, productId]
    );

    if (!row) return null;
    return this.mapRow(row);
  }

  getCreatorProducts(guildId, creatorId) {
    const rows = this.db.all(
      'SELECT id, guild_id, creator_id, content_id, price_minor, currency, listing_status, created_at, updated_at FROM creator_marketplace WHERE guild_id = ? AND creator_id = ? ORDER BY created_at DESC',
      [guildId, creatorId]
    );

    return rows.map(row => this.mapRow(row));
  }

  listCreatorProduct(guildId, productId, creatorId) {
    const product = this.db.get(
      'SELECT id, guild_id, creator_id, content_id, price_minor, currency, listing_status, created_at, updated_at FROM creator_marketplace WHERE guild_id = ? AND id = ?',
      [guildId, productId]
    );

    if (!product) return { notFound: true };

    if (product.creator_id !== creatorId) {
      return { notOwner: true };
    }

    if (product.listing_status !== 'unlisted') {
      return { alreadyListed: true, product: this.mapRow(product) };
    }

    this.db.exec(
      `UPDATE creator_marketplace SET listing_status = 'listed', updated_at = ? WHERE guild_id = ? AND id = ?`,
      [new Date().toISOString(), guildId, productId]
    );

    const row = this.db.get(
      'SELECT id, guild_id, creator_id, content_id, price_minor, currency, listing_status, created_at, updated_at FROM creator_marketplace WHERE guild_id = ? AND id = ?',
      [guildId, productId]
    );

    return { notFound: false, product: this.mapRow(row) };
  }

  unlistCreatorProduct(guildId, productId, creatorId) {
    const product = this.db.get(
      'SELECT id, guild_id, creator_id, content_id, price_minor, currency, listing_status, created_at, updated_at FROM creator_marketplace WHERE guild_id = ? AND id = ?',
      [guildId, productId]
    );

    if (!product) return { notFound: true };

    if (product.creator_id !== creatorId) {
      return { notOwner: true };
    }

    if (product.listing_status !== 'listed') {
      return { alreadyUnlisted: true, product: this.mapRow(product) };
    }

    this.db.exec(
      `UPDATE creator_marketplace SET listing_status = 'unlisted', updated_at = ? WHERE guild_id = ? AND id = ?`,
      [new Date().toISOString(), guildId, productId]
    );

    const row = this.db.get(
      'SELECT id, guild_id, creator_id, content_id, price_minor, currency, listing_status, created_at, updated_at FROM creator_marketplace WHERE guild_id = ? AND id = ?',
      [guildId, productId]
    );

    return { notFound: false, product: this.mapRow(row) };
  }

  mapRow(row) {
    return {
      id: row.id,
      guildId: row.guild_id,
      creatorId: row.creator_id,
      contentId: row.content_id,
      priceMinor: row.price_minor,
      currency: row.currency,
      listingStatus: row.listing_status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

module.exports = { CreatorMarketplaceRepository };