const Database = require('../database/database');
const {
  ObjectiveMessageCount,
  StatusAvailable,
  StatusActive,
  StatusCompleted,
  ErrNoSuchAchievement,
  errGuildRequired,
  errGuildUserRequired,
  formatTime,
  parseTime,
  createAchievement,
  createMemberAchievement,
  memberAchievementProgressText,
  nextProgress
} = require('./model');
const { DefaultAchievements } = require('./seed');

class AchievementRepository {
  constructor(db, defs = DefaultAchievements()) {
    this.db = db; // Database instance
    this.defs = defs;
  }

  ensureGuildAchievements(guildID, now) {
    if (!guildID) {
      throw new Error('guild id is required');
    }
    const ts = formatTime(now);
    const insert = `INSERT OR IGNORE INTO achievements
      (guild_id, achievement_key, name, description, objective_type, target,
       reward_xp, enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`;

    for (const d of this.defs) {
      this.db.exec(insert, [
        guildID, d.Key, d.Name, d.Description, d.ObjectiveType,
        d.Target, d.RewardXP, ts, ts
      ]);
    }
  }

  ensureMemberAchievements(guildID, userID, now) {
    if (!guildID || !userID) {
      throw new Error('guild id and user id are required');
    }
    const ts = formatTime(now);

    const rows = this.db.db.prepare(
      `SELECT id, reward_xp FROM achievements WHERE guild_id = ? AND enabled = 1`
    ).all(guildID);

    const insert = `INSERT OR IGNORE INTO member_achievements
      (guild_id, user_id, achievement_id, progress, status, started_at,
       completed_at, created_at, updated_at)
      VALUES (?, ?, ?, 0, 'available', ?, null, ?, ?)`;

    for (const a of rows) {
      this.db.exec(insert, [
        guildID, userID, a.id, ts, ts, ts
      ]);
    }
  }

  getMemberAchievements(guildID, userID, now) {
    const rows = this.db.db.prepare(`
      SELECT ma.id, ma.guild_id, ma.user_id, ma.achievement_id,
             a.achievement_key, a.name, a.description, a.objective_type,
             a.target, a.reward_xp, ma.progress, ma.status,
             ma.started_at, ma.completed_at, ma.created_at, ma.updated_at
      FROM member_achievements ma
      JOIN achievements a ON a.id = ma.achievement_id
      WHERE ma.guild_id = ? AND ma.user_id = ?
      ORDER BY ma.id
    `).all(guildID, userID);

    return rows.map(row => this.scanMemberAchievement(row, now));
  }

  getMemberAchievement(guildID, userID, key, now) {
    const row = this.db.db.prepare(`
      SELECT ma.id, ma.guild_id, ma.user_id, ma.achievement_id,
             a.achievement_key, a.name, a.description, a.objective_type,
             a.target, a.reward_xp, ma.progress, ma.status,
             ma.started_at, ma.completed_at, ma.created_at, ma.updated_at
      FROM member_achievements ma
      JOIN achievements a ON a.id = ma.achievement_id
      WHERE ma.guild_id = ? AND ma.user_id = ? AND a.achievement_key = ?
    `).get(guildID, userID, key);

    if (!row) return null;
    return this.scanMemberAchievement(row, now);
  }

  scanMemberAchievement(row, now) {
    const ma = createMemberAchievement(
      row.id, row.guild_id, row.user_id, row.achievement_id,
      row.achievement_key, row.name, row.description, row.objective_type,
      row.target, row.reward_xp, row.progress, row.status,
      parseTime(row.started_at),
      row.completed_at ? parseTime(row.completed_at) : null,
      parseTime(row.created_at),
      parseTime(row.updated_at)
    );

    if (ma.status === StatusAvailable && ma.progress > 0) {
      if (ma.progress >= ma.target) {
        ma.status = StatusCompleted;
      } else {
        ma.status = StatusActive;
      }
    }
    return ma;
  }

  getAllAchievements(guildID, now) {
    const rows = this.db.db.prepare(
      `SELECT id, guild_id, achievement_key, name, description, objective_type, target, reward_xp, enabled, created_at, updated_at
       FROM achievements WHERE guild_id = ? ORDER BY id`
    ).all(guildID);

    return rows.map(row => this.scanAchievement(row));
  }

  scanAchievement(row) {
    return createAchievement(
      row.id, row.guild_id, row.achievement_key, row.name, row.description,
      row.objective_type, row.target, row.reward_xp, row.enabled === 1,
      parseTime(row.created_at), parseTime(row.updated_at)
    );
  }

  getAchievementByKey(guildID, key) {
    const row = this.db.db.prepare(`
      SELECT id, guild_id, achievement_key, name, description, objective_type, target, reward_xp, enabled, created_at, updated_at
      FROM achievements WHERE guild_id = ? AND achievement_key = ?
    `).get(guildID, key);

    if (!row) return null;
    return this.scanAchievement(row);
  }

  processActivityTx(guildID, userID, now) {
    this.ensureGuildAchievements(guildID, now);
    this.ensureMemberAchievements(guildID, userID, now);

    const ts = formatTime(now);
    const rows = this.db.db.prepare(`
      SELECT ma.id, ma.guild_id, ma.user_id, ma.achievement_id,
             a.achievement_key, a.name, a.description, a.objective_type,
             a.target, a.reward_xp, ma.progress, ma.status, ma.started_at,
             ma.completed_at, ma.created_at, ma.updated_at
      FROM member_achievements ma
      JOIN achievements a ON a.id = ma.achievement_id
      WHERE ma.guild_id = ? AND ma.user_id = ?
      ORDER BY ma.id
    `).all(guildID, userID);

    const completed = [];

    for (const row of rows) {
      const ma = this.scanMemberAchievement(row, now);

      if (ma.status === StatusCompleted) continue;

      if (ma.status === StatusAvailable) {
        if (ma.progress >= ma.target) {
          ma.status = StatusCompleted;
        } else {
          ma.status = StatusActive;
        }
      }
      if (ma.status !== StatusActive) continue;

      const next = this.nextProgress(ma.objectiveType, ma.progress, ma.target);
      if (next >= ma.target) {
        this.db.exec(
          `UPDATE member_achievements SET progress = ?, status = ?, completed_at = ?, updated_at = ? WHERE id = ?`,
          [ma.target, StatusCompleted, ts, ts, ma.id]
        );
        ma.progress = ma.target;
        ma.status = StatusCompleted;
        ma.completedAt = now;
        completed.push(ma);
      } else {
        this.db.exec(
          `UPDATE member_achievements SET progress = ?, status = ?, updated_at = ? WHERE id = ?`,
          [next, StatusActive, ts, ma.id]
        );
        ma.progress = next;
        ma.status = StatusActive;
      }
    }
    return completed;
  }

  nextProgress(objectiveType, current, target) {
    return nextProgress(objectiveType, current, target);
  }
}

module.exports = { AchievementRepository };