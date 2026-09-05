const Database = require('../database/database');

class AnalyticsRepository {
  constructor(db) {
    this.db = db; // Database instance
  }

  incrementDay(guildID, userID) {
    if (!guildID || !userID) {
      throw new Error('guild id and user id are required');
    }
    const dayKey = new Date().toISOString().split('T')[0];

    // Increment day counter for guild
    const guildRow = this.db.db.prepare(
      `SELECT message_count FROM guild_daily_analytics WHERE guild_id = ? AND day = ?`
    ).get(guildID, dayKey);

    if (guildRow) {
      this.db.exec(
        `UPDATE guild_daily_analytics SET message_count = ?, updated_at = ? WHERE guild_id = ? AND day = ?`,
        [guildRow.message_count + 1, new Date().toISOString(), guildID, dayKey]
      );
    } else {
      this.db.exec(
        `INSERT INTO guild_daily_analytics (guild_id, day, message_count, created_at, updated_at) VALUES (?, ?, 1, ?, ?)`,
        [guildID, dayKey, new Date().toISOString(), new Date().toISOString()]
      );
    }

    // Increment day counter for guild+user
    const userRow = this.db.db.prepare(
      `SELECT COUNT(*) as cnt FROM guild_daily_active_members WHERE guild_id = ? AND day = ? AND user_id = ?`
    ).get(guildID, dayKey, userID);

    if (userRow && userRow.cnt > 0) {
      this.db.exec(
        `UPDATE guild_daily_active_members SET created_at = ? WHERE guild_id = ? AND day = ? AND user_id = ?`,
        [new Date().toISOString(), guildID, dayKey, userID]
      );
    } else {
      this.db.exec(
        `INSERT INTO guild_daily_active_members (guild_id, day, user_id, created_at) VALUES (?, ?, ?, ?)`,
        [guildID, dayKey, userID, new Date().toISOString()]
      );
    }
  }

  getServerSummary(guildID, limit = 10) {
    if (!guildID) {
      return null;
    }
    const rows = this.db.db.prepare(`
      SELECT day, message_count FROM guild_daily_analytics
      WHERE guild_id = ?
      ORDER BY day DESC
      LIMIT ?
    `).all(guildID, limit);

    const activeRows = this.db.db.prepare(`
      SELECT user_id, COUNT(*) as activeCount FROM guild_daily_active_members
      WHERE guild_id = ?
      GROUP BY user_id
      ORDER BY activeCount DESC
      LIMIT ?
    `).all(guildID, limit);

    const messagesToday = this.db.db.prepare(`
      SELECT message_count FROM guild_daily_analytics
      WHERE guild_id = ? AND day = ?
    `).get(guildID, new Date().toISOString().split('T')[0]);

    return {
      messagesToday: messagesToday ? messagesToday.message_count : 0,
      knownMembers: activeRows ? activeRows.length : 0,
      messages: rows.map(r => ({
        day: r.day,
        messageCount: r.message_count
      })),
      activeMembers: activeRows ? activeRows.map(r => ({ userId: r.user_id, count: r.activeCount })) : []
    };
  }

  getDailyActivity(guildID, limit = 10) {
    if (!guildID) {
      return null;
    }
    const rows = this.db.db.prepare(`
      SELECT day, message_count, user_id FROM guild_daily_active_members
      WHERE guild_id = ?
      ORDER BY day DESC
      LIMIT ?
    `).all(guildID, limit);

    return rows.map(r => ({
      day: r.day,
      messageCount: this.db.db.prepare(
        `SELECT message_count FROM guild_daily_analytics WHERE guild_id = ? AND day = ?`
      ).get(guildID, r.day) ? this.db.db.prepare(
        `SELECT message_count FROM guild_daily_analytics WHERE guild_id = ? AND day = ?`
      ).get(guildID, r.day).messageCount : 0,
      activeMembers: r.user_id ? 1 : 0
    }));
  }
}

module.exports = { AnalyticsRepository };