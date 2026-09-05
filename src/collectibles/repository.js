const Database = require('../database/database');
const {
  ErrNoSuchCollectible,
  ErrAlreadyOwned,
  errGuildRequired,
  errGuildUserRequired,
  createCollectible,
  createMemberCollectible,
  formatTime,
  parseTime
} = require('./model');
const { DefaultCollectibles } = require('./seed');

class CollectibleRepository {
  constructor(db, defs = DefaultCollectibles()) {
    this.db = db; // Database instance
    this.defs = defs;
  }

  ensureGuildCollectibles(guildID, now) {
    if (!guildID) {
      throw new Error('guild id is required');
    }
    const ts = formatTime(now);
    const insert = `INSERT OR IGNORE INTO collectibles
      (guild_id, collectible_key, name, description, rarity, icon, enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`;

    for (const d of this.defs) {
      this.db.exec(insert, [
        guildID, d.Key, d.Name, d.Description, d.Rarity, d.Icon, ts, ts
      ]);
    }
  }

  getCollectibleByKey(guildID, key) {
    const row = this.db.db.prepare(`
      SELECT id, guild_id, collectible_key, name, description, rarity, icon, enabled, created_at, updated_at
      FROM collectibles WHERE guild_id = ? AND collectible_key = ?
    `).get(guildID, key);

    if (!row) {
      return null;
    }
    return this.scanCollectible(row);
  }

  scanCollectible(row) {
    return createCollectible(
      row.id, row.guild_id, row.collectible_key, row.name, row.description,
      row.rarity, row.icon, row.enabled === 1, parseTime(row.created_at), parseTime(row.updated_at)
    );
  }

  getCollection(guildID, userID) {
    const rows = this.db.db.prepare(`
      SELECT mc.id, mc.guild_id, mc.user_id, mc.collectible_id,
             c.collectible_key, c.name, c.description, c.rarity, c.icon,
             mc.source, mc.obtained_at, mc.created_at
      FROM member_collectibles mc
      JOIN collectibles c ON c.id = mc.collectible_id
      WHERE mc.guild_id = ? AND mc.user_id = ?
      ORDER BY c.rarity, c.name
    `).all(guildID, userID);

    return rows.map(row => this.scanMemberCollectible(row));
  }

  scanMemberCollectible(row) {
    return createMemberCollectible(
      row.id, row.guild_id, row.user_id, row.collectible_id,
      row.collectible_key, row.name, row.description, row.rarity, row.icon,
      row.source, parseTime(row.obtained_at), parseTime(row.created_at)
    );
  }

  collectionCount(guildID) {
    const row = this.db.db.prepare(`
      SELECT COUNT(*) as cnt FROM collectibles WHERE guild_id = ? AND enabled = 1
    `).get(guildID);
    return row ? row.cnt : 0;
  }

  grantCollectibleTx(guildID, userID, collectibleKey, source, now) {
    const ts = formatTime(now);

    const row = this.db.db.prepare(`
      SELECT id FROM collectibles WHERE guild_id = ? AND collectible_key = ?
    `).get(guildID, collectibleKey);

    if (!row) {
      return [false, ErrNoSuchCollectible];
    }

    const collectibleID = row.id;

    const result = this.db.exec(
      `INSERT OR IGNORE INTO member_collectibles
        (guild_id, user_id, collectible_id, source, obtained_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?)`,
      [guildID, userID, collectibleID, source, ts, ts]
    );
    // INSERT OR IGNORE affects 1 row if inserted, 0 if duplicate (ignored)
    return [result.changes > 0, null];
  }

  hasCollectible(guildID, userID, collectibleKey) {
    const collectible = this.getCollectibleByKey(guildID, collectibleKey);
    if (!collectible) {
      return false;
    }

    const row = this.db.db.prepare(`
      SELECT 1 FROM member_collectibles
      WHERE guild_id = ? AND user_id = ? AND collectible_id = ?
      LIMIT 1
    `).get(guildID, userID, collectible.id);

    return row !== undefined;
  }
}

module.exports = { CollectibleRepository };