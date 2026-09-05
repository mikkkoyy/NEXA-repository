const Database = require('../database/database');
const {
  WorldMoodCalm,
  WorldMoodBloom,
  WorldMoodStorm,
  WorldMoodEclipse,
  currentMood,
  statusText,
  createWorldState
} = require('./model');

class WorldRepository {
  constructor(db) {
    this.db = db; // Database instance
  }

  ensureGuildWorld(guildID, now) {
    if (!guildID) {
      throw new Error('guild id is required');
    }
    const ts = now.toISOString();

    const existing = this.db.db.prepare(
      `SELECT pulse, created_at, updated_at FROM world_states WHERE guild_id = ?`
    ).get(guildID);

    if (existing) {
      this.db.exec(
        `UPDATE world_states SET pulse = pulse + 1, updated_at = ? WHERE guild_id = ?`,
        [ts, guildID]
      );
    } else {
      this.db.exec(
        `INSERT INTO world_states (guild_id, pulse, created_at, updated_at) VALUES (?, 1, ?, ?)`,
        [guildID, ts, ts]
      );
    }
  }

  getWorldState(guildID) {
    if (!guildID) {
      return null;
    }
    const row = this.db.db.prepare(
      `SELECT pulse, created_at, updated_at FROM world_states WHERE guild_id = ?`
    ).get(guildID);

    if (!row) return null;

    return createWorldState(
      guildID,
      row.pulse,
      row.created_at,
      row.updated_at,
      currentMood(row.pulse)
    );
  }
}

module.exports = { WorldRepository };