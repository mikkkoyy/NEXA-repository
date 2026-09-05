const Database = require('../database/database');

class CreatorEarningsRepository {
  constructor(db) {
    this.db = db;
  }

  ensureSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS creator_earnings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        creator_id INTEGER NOT NULL,
        purchase_id INTEGER NOT NULL,
        payment_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        gross_amount_minor INTEGER NOT NULL,
        platform_fee_minor INTEGER NOT NULL,
        net_amount_minor INTEGER NOT NULL,
        currency TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(purchase_id)
      )
    `);
  }

  createEarning(guildId, creatorId, purchaseId, paymentId, productId, grossAmountMinor, currency) {
    const platformFeeMinor = Math.floor(grossAmountMinor * 20 / 100);
    const netAmountMinor = grossAmountMinor - platformFeeMinor;
    const now = new Date().toISOString();

    const existing = this.db.get(
      'SELECT id FROM creator_earnings WHERE purchase_id = ?',
      [purchaseId]
    );

    if (existing) {
      return { duplicate: true, earning: this.mapRow(existing) };
    }

    this.db.exec(
      `INSERT INTO creator_earnings
        (guild_id, creator_id, purchase_id, payment_id, product_id, gross_amount_minor, platform_fee_minor, net_amount_minor, currency, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [guildId, creatorId, purchaseId, paymentId, productId, grossAmountMinor, platformFeeMinor, netAmountMinor, currency, 'pending', now, now]
    );

    const row = this.db.get(
      'SELECT id, guild_id, creator_id, purchase_id, payment_id, product_id, gross_amount_minor, platform_fee_minor, net_amount_minor, currency, status, created_at, updated_at FROM creator_earnings WHERE purchase_id = ?',
      [purchaseId]
    );

    return { duplicate: false, earning: this.mapRow(row) };
  }

  getEarning(guildId, earningId) {
    const row = this.db.get(
      'SELECT id, guild_id, creator_id, purchase_id, payment_id, product_id, gross_amount_minor, platform_fee_minor, net_amount_minor, currency, status, created_at, updated_at FROM creator_earnings WHERE guild_id = ? AND id = ?',
      [guildId, earningId]
    );

    if (!row) return null;
    return this.mapRow(row);
  }

  getEarningByPurchase(guildId, purchaseId) {
    const row = this.db.get(
      'SELECT id, guild_id, creator_id, purchase_id, payment_id, product_id, gross_amount_minor, platform_fee_minor, net_amount_minor, currency, status, created_at, updated_at FROM creator_earnings WHERE guild_id = ? AND purchase_id = ?',
      [guildId, purchaseId]
    );

    if (!row) return null;
    return this.mapRow(row);
  }

  getCreatorEarnings(guildId, creatorId) {
    const rows = this.db.all(
      'SELECT id, guild_id, creator_id, purchase_id, payment_id, product_id, gross_amount_minor, platform_fee_minor, net_amount_minor, currency, status, created_at, updated_at FROM creator_earnings WHERE guild_id = ? AND creator_id = ? ORDER BY created_at DESC, id DESC',
      [guildId, creatorId]
    );

    return rows.map(row => this.mapRow(row));
  }

  getGuildEarnings(guildId) {
    const rows = this.db.all(
      'SELECT id, guild_id, creator_id, purchase_id, payment_id, product_id, gross_amount_minor, platform_fee_minor, net_amount_minor, currency, status, created_at, updated_at FROM creator_earnings WHERE guild_id = ? ORDER BY created_at DESC, id DESC',
      [guildId]
    );

    return rows.map(row => this.mapRow(row));
  }

  mapRow(row) {
    return {
      id: row.id,
      guildId: row.guild_id,
      creatorId: row.creator_id,
      purchaseId: row.purchase_id,
      paymentId: row.payment_id,
      productId: row.product_id,
      grossAmountMinor: row.gross_amount_minor,
      platformFeeMinor: row.platform_fee_minor,
      netAmountMinor: row.net_amount_minor,
      currency: row.currency,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

module.exports = { CreatorEarningsRepository };