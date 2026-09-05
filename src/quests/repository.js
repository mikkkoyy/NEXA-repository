const Database = require('../database/database');
const {
  ObjectiveMessageCount,
  StatusActive,
  StatusCompleted,
  StatusExpired,
  errGuildRequired,
  errGuildUserRequired,
  formatTime,
  parseTime,
  createMemberQuest,
  memberQuestProgressText,
  nextProgress
} = require('./model');
const { DefaultQuests } = require('./seed');

class QuestRepository {
  constructor(db, defs = DefaultQuests()) {
    this.db = db; // Database instance
    this.defs = defs;
  }

  ensureGuildQuests(guildID, now) {
    if (!guildID) {
      throw new Error('guild id is required');
    }
    const ts = formatTime(now);
    const insert = `INSERT OR IGNORE INTO quests
      (guild_id, quest_key, name, description, objective_type, target,
       xp_reward, collectible_reward_key, duration_seconds, enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`;

    for (const d of this.defs) {
      this.db.exec(insert, [
        guildID, d.Key, d.Name, d.Description, ObjectiveMessageCount,
        d.Target, d.XP, d.CollectibleRewardKey || null, d.DurationSeconds, ts, ts
      ]);
    }
  }

  ensureMemberQuests(guildID, userID, now) {
    if (!guildID || !userID) {
      throw new Error('guild id and user id are required');
    }
    const ts = formatTime(now);

    const rows = this.db.db.prepare(
      `SELECT id, duration_seconds FROM quests WHERE guild_id = ? AND enabled = 1`
    ).all(guildID);

    const insert = `INSERT OR IGNORE INTO member_quests
      (guild_id, user_id, quest_id, progress, status, started_at,
       expires_at, reward_claimed, created_at, updated_at)
      VALUES (?, ?, ?, 0, 'active', ?, ?, 0, ?, ?)`;

    for (const q of rows) {
      const expires = q.duration_seconds > 0
        ? formatTime(new Date(now.getTime() + q.duration_seconds * 1000))
        : null;

      this.db.exec(insert, [
        guildID, userID, q.id, ts, expires, ts, ts
      ]);
    }
  }

  getMemberQuests(guildID, userID, now) {
    const rows = this.db.db.prepare(`
      SELECT mq.id, mq.guild_id, mq.user_id, mq.quest_id,
             q.quest_key, q.name, q.description, q.objective_type, q.target,
             q.xp_reward, q.collectible_reward_key, mq.progress, mq.status, mq.started_at, mq.completed_at,
             mq.expires_at, mq.reward_claimed
      FROM member_quests mq
      JOIN quests q ON q.id = mq.quest_id
      WHERE mq.guild_id = ? AND mq.user_id = ?
      ORDER BY mq.id
    `).all(guildID, userID);

    return rows.map(row => this.scanMemberQuest(row, now));
  }

  getMemberQuest(guildID, userID, key, now) {
    const row = this.db.db.prepare(`
      SELECT mq.id, mq.guild_id, mq.user_id, mq.quest_id,
             q.quest_key, q.name, q.description, q.objective_type, q.target,
             q.xp_reward, q.collectible_reward_key, mq.progress, mq.status, mq.started_at, mq.completed_at,
             mq.expires_at, mq.reward_claimed
      FROM member_quests mq
      JOIN quests q ON q.id = mq.quest_id
      WHERE mq.guild_id = ? AND mq.user_id = ? AND q.quest_key = ?
    `).get(guildID, userID, key);

    if (!row) return null;
    return this.scanMemberQuest(row, now);
  }

  scanMemberQuest(row, now) {
    const mq = createMemberQuest(
      row.id, row.guild_id, row.user_id, row.quest_id,
      row.quest_key, row.name, row.description, row.objective_type,
      row.target, row.xp_reward, row.collectible_reward_key, row.progress, row.status,
      parseTime(row.started_at),
      row.completed_at ? parseTime(row.completed_at) : null,
      row.expires_at ? parseTime(row.expires_at) : null,
      row.reward_claimed === 1
    );

    if (mq.status === StatusActive && mq.expiresAt && now > mq.expiresAt) {
      mq.status = StatusExpired;
    }
    return mq;
  }

  processActivityTx(guildID, userID, now) {
    this.ensureGuildQuests(guildID, now);
    this.ensureMemberQuests(guildID, userID, now);

    const ts = formatTime(now);
    const rows = this.db.db.prepare(`
      SELECT mq.id, mq.guild_id, mq.user_id, mq.quest_id,
             q.quest_key, q.name, q.description, q.objective_type, q.target,
             q.xp_reward, q.collectible_reward_key, mq.progress, mq.status, mq.started_at, mq.completed_at,
             mq.expires_at, mq.reward_claimed
      FROM member_quests mq
      JOIN quests q ON q.id = mq.quest_id
      WHERE mq.guild_id = ? AND mq.user_id = ?
      ORDER BY mq.id
    `).all(guildID, userID);

    const completed = [];

    for (const row of rows) {
      const mq = this.scanMemberQuest(row, now);

      if (mq.status === StatusActive && mq.expiresAt && now > mq.expiresAt) {
        this.db.exec(
          `UPDATE member_quests SET status = ?, updated_at = ? WHERE id = ?`,
          [StatusExpired, ts, mq.id]
        );
        continue;
      }
      if (mq.status !== StatusActive) continue;

      const next = this.nextProgress(mq.objectiveType, mq.progress, mq.target);
      if (next >= mq.target) {
        this.db.exec(
          `UPDATE member_quests SET progress = ?, status = ?, completed_at = ?, reward_claimed = 1, updated_at = ? WHERE id = ?`,
          [mq.target, StatusCompleted, ts, ts, mq.id]
        );
        mq.progress = mq.target;
        mq.status = StatusCompleted;
        mq.completedAt = now;
        mq.rewardClaimed = true;
        completed.push(mq);
      } else {
        this.db.exec(
          `UPDATE member_quests SET progress = ?, updated_at = ? WHERE id = ?`,
          [next, ts, mq.id]
        );
        mq.progress = next;
      }
    }
    return completed;
  }

  nextProgress(objectiveType, current, target) {
    let step = 0;
    switch (objectiveType) {
      case ObjectiveMessageCount:
        step = 1;
        break;
      default:
        return current;
    }
    const next = current + step;
    return next > target ? target : next;
  }
}

module.exports = { QuestRepository };