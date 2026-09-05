const Database = require('../database/database');

class CreatorRepository {
  constructor(db) {
    this.db = db;
  }

  ensureSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS creator_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        display_name TEXT,
        bio TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(guild_id, user_id)
      )
    `);
  }

  exists(guildId, userId) {
    const row = this.db.get(
      'SELECT id FROM creator_profiles WHERE guild_id = ? AND user_id = ?',
      [guildId, userId]
    );
    return !!row;
  }

  createCreator(guildId, userId, displayName, status = 'pending') {
    const now = new Date().toISOString();

    const existing = this.db.get(
      'SELECT id, guild_id, user_id, display_name, bio, status, created_at, updated_at FROM creator_profiles WHERE guild_id = ? AND user_id = ?',
      [guildId, userId]
    );

    if (existing) {
      return { duplicate: true, creator: this.mapRow(existing) };
    }

    this.db.exec(
      `INSERT INTO creator_profiles
        (guild_id, user_id, display_name, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)`,
      [guildId, userId, displayName, status, now, now]
    );

    const row = this.db.get(
      'SELECT id, guild_id, user_id, display_name, bio, status, created_at, updated_at FROM creator_profiles WHERE guild_id = ? AND user_id = ?',
      [guildId, userId]
    );

    return { duplicate: false, creator: this.mapRow(row) };
  }

  getCreator(guildId, userId) {
    const row = this.db.get(
      'SELECT id, guild_id, user_id, display_name, bio, status, created_at, updated_at FROM creator_profiles WHERE guild_id = ? AND user_id = ?',
      [guildId, userId]
    );

    if (!row) return null;
    return this.mapRow(row);
  }

  getCreatorByUser(guildId, userId) {
    return this.getCreator(guildId, userId);
  }

  updateCreatorStatus(guildId, userId, status) {
    if (status !== 'pending' && status !== 'active' && status !== 'suspended') {
      throw new Error('Invalid creator status: ' + status);
    }

    const ts = new Date().toISOString();
    this.db.exec(
      `UPDATE creator_profiles SET status = ?, updated_at = ? WHERE guild_id = ? AND user_id = ?`,
      [status, ts, guildId, userId]
    );

    const row = this.db.get(
      'SELECT id, guild_id, user_id, display_name, bio, status, created_at, updated_at FROM creator_profiles WHERE guild_id = ? AND user_id = ?',
      [guildId, userId]
    );

    return this.mapRow(row);
  }

  mapRow(row) {
    return {
      id: row.id,
      guildId: row.guild_id,
      userId: row.user_id,
      displayName: row.display_name,
      bio: row.bio,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

module.exports = { CreatorRepository };