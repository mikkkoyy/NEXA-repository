const Database = require('../database/database');

class ModerationRepository {
  constructor(db) {
    this.db = db; // Database instance
  }

  addWarning(guildID, userID, moderatorID, moderatorName, reason) {
    if (!guildID || !userID || !moderatorID) {
      throw new Error('guild id, user id, and moderator id are required');
    }
    const ts = new Date().toISOString();

    this.db.exec(
      `INSERT INTO moderation_warnings
        (guild_id, user_id, moderator_id, moderator_name, reason, created_at)
        VALUES (?, ?, ?, ?, ?, ?)`,
      [guildID, userID, moderatorID, moderatorName, reason, ts]
    );
  }

  getWarnings(guildID, userID) {
    if (!guildID || !userID) {
      return [];
    }
    const rows = this.db.db.prepare(
      `SELECT id, guild_id, user_id, moderator_id, moderator_name, reason, created_at
       FROM moderation_warnings
       WHERE guild_id = ? AND user_id = ?
       ORDER BY created_at DESC`
    ).all(guildID, userID);

    return rows.map(row => ({
      id: row.id,
      guildID: row.guild_id,
      userID: row.user_id,
      moderatorID: row.moderator_id,
      moderatorName: row.moderator_name,
      reason: row.reason,
      createdAt: row.created_at
    }));
  }

  getGuildWarnings(guildID, limit = 100) {
    if (!guildID) {
      return [];
    }
    const rows = this.db.db.prepare(
      `SELECT id, guild_id, user_id, moderator_id, moderator_name, reason, created_at
       FROM moderation_warnings
       WHERE guild_id = ?
       ORDER BY created_at DESC
       LIMIT ?`
    ).all(guildID, limit);

    return rows.map(row => ({
      id: row.id,
      guildID: row.guild_id,
      userID: row.user_id,
      moderatorID: row.moderator_id,
      moderatorName: row.moderator_name,
      reason: row.reason,
      createdAt: row.created_at
    }));
  }
}

module.exports = { ModerationRepository };