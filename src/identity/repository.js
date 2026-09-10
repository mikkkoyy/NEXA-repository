const Database = require('../database/database');

const PROFILE_SCHEMA = `CREATE TABLE IF NOT EXISTS member_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  display_name TEXT,
  xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  reputation INTEGER NOT NULL DEFAULT 0,
  message_count INTEGER NOT NULL DEFAULT 0,
  first_seen_at TEXT NOT NULL,
  last_active_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(guild_id, user_id)
)`;

const LEVEL_CAP = 1000000;

function xpForLevel(level) {
  if (level < 1) return 0;
  if (level > LEVEL_CAP) level = LEVEL_CAP;
  return 25 * (level - 1) * (level + 2);
}

function levelForXP(xp) {
  if (xp <= 0) return 1;
  const scaled = Math.floor(xp / 25);
  const discriminant = 1 + 4 * (scaled + 2);
  let level = Math.floor((Math.sqrt(discriminant) - 1) / 2);
  if (level < 1) level = 1;
  if (level > LEVEL_CAP) level = LEVEL_CAP;
  while (level < LEVEL_CAP && xpForLevel(level + 1) <= xp) level++;
  while (level > 1 && xpForLevel(level) > xp) level--;
  return level;
}

function formatTime(t) {
  return t.toISOString();
}

function parseTime(raw) {
  return new Date(raw);
}

class ProfileRepository {
  constructor(dbOrPath) {
    if (dbOrPath instanceof Database) {
      this.db = dbOrPath;
    } else {
      this.db = new Database(dbOrPath);
      this.db.exec(PROFILE_SCHEMA);
    }
  }

  get dbInstance() {
    return this.db;
  }

  ensureSchema() {
    this.db.exec(PROFILE_SCHEMA);
  }

  ensureProfile(ctx, guildID, userID, username, displayName, now) {
    const ts = formatTime(now);
    const existing = this.db.get(
      'SELECT id FROM member_profiles WHERE guild_id = ? AND user_id = ?',
      [guildID, userID]
    );

    if (existing) {
      this.db.exec(
        'UPDATE member_profiles SET username = ?, display_name = ?, updated_at = ? WHERE guild_id = ? AND user_id = ?',
        [username, displayName, ts, guildID, userID]
      );
    } else {
      this.db.exec(
        `INSERT INTO member_profiles
          (guild_id, user_id, username, display_name, xp, level, reputation,
           message_count, first_seen_at, last_active_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, 0, 1, 0, 0, ?, ?, ?, ?)`,
        [guildID, userID, username, displayName, ts, ts, ts, ts]
      );
    }
  }

  getProfile(ctx, guildID, userID) {
    const row = this.db.get(
      `SELECT guild_id, user_id, username, COALESCE(display_name, '') AS display_name,
              xp, level, reputation, message_count,
              first_seen_at, last_active_at, created_at, updated_at
       FROM member_profiles WHERE guild_id = ? AND user_id = ?`,
      [guildID, userID]
    );

    if (!row) return null;

    return {
      guildID: row.guild_id,
      userID: row.user_id,
      username: row.username,
      displayName: row.display_name || '',
      xp: row.xp,
      level: row.level,
      reputation: row.reputation,
      messageCount: row.message_count,
      firstSeenAt: parseTime(row.first_seen_at),
      lastActiveAt: parseTime(row.last_active_at),
      createdAt: parseTime(row.created_at),
      updatedAt: parseTime(row.updated_at)
    };
  }

  recordActivity(ctx, guildID, userID, username, displayName, xpDelta, now) {
    const ts = formatTime(now);

    const existing = this.db.get(
      'SELECT xp, message_count FROM member_profiles WHERE guild_id = ? AND user_id = ?',
      [guildID, userID]
    );

    if (!existing) {
      const newLevel = levelForXP(xpDelta);
      this.db.exec(
        `INSERT INTO member_profiles
          (guild_id, user_id, username, display_name, xp, level, reputation,
           message_count, first_seen_at, last_active_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?, ?, ?, ?)`,
        [guildID, userID, username, displayName, xpDelta, newLevel, ts, ts, ts, ts]
      );
    } else {
      const newXP = existing.xp + xpDelta;
      const newLevel = levelForXP(newXP);
      this.db.exec(
        `UPDATE member_profiles
          SET xp = ?, level = ?, message_count = ?, last_active_at = ?,
              updated_at = ?, username = ?, display_name = ?
        WHERE guild_id = ? AND user_id = ?`,
        [newXP, newLevel, existing.message_count + 1, ts, ts, username, displayName, guildID, userID]
      );
    }
  }

  getMemberProfileData(ctx, guildID, userID) {
    const row = this.db.get(
      'SELECT xp, message_count FROM member_profiles WHERE guild_id = ? AND user_id = ?',
      [guildID, userID]
    );
    return row;
  }

  addXPTx(ctx, guildID, userID, delta, now) {
    const ts = formatTime(now);
    const existing = this.db.get(
      'SELECT xp FROM member_profiles WHERE guild_id = ? AND user_id = ?',
      [guildID, userID]
    );

    if (!existing) {
      const newLevel = levelForXP(delta);
      this.db.exec(
        `INSERT INTO member_profiles
          (guild_id, user_id, username, display_name, xp, level, reputation,
           message_count, first_seen_at, last_active_at, created_at, updated_at)
         VALUES (?, ?, '', '', ?, ?, 0, 0, ?, ?, ?, ?)`,
        [guildID, userID, delta, newLevel, ts, ts, ts, ts]
      );
    } else {
      const newXP = existing.xp + delta;
      const newLevel = levelForXP(newXP);
      this.db.exec(
        `UPDATE member_profiles
          SET xp = ?, level = ?, updated_at = ?
        WHERE guild_id = ? AND user_id = ?`,
        [newXP, newLevel, ts, guildID, userID]
      );
    }
  }
}

module.exports = {
  ProfileRepository,
  xpForLevel,
  levelForXP
};