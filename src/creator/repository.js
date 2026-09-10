/**
 * src/creator/repository.js
 * 
 * Data Access Layer for handling creator profiles and statuses.
 */

const Database = require('../database/database');

// Table schema constraint for Creator Profiles
const CREATOR_SCHEMA = `
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
)`;

class CreatorRepository {
  /**
   * Instantiates the repository layer.
   * @param {Database} db - An active database driver instance 
   */
  constructor(db) {
    this.db = db;
    this.ensureSchema();
  }

  /**
   * Ensures that the creator profiles schema is migrated into the current driver.
   */
  ensureSchema() {
    this.db.exec(CREATOR_SCHEMA);
  }

  /**
   * Checks whether a specific user is registered as a creator.
   * 
   * @param {string} guildId - Target Discord Guild ID 
   * @param {string} userId - Target Discord User ID 
   * @returns {boolean} True if the row exists, false otherwise
   */
  exists(guildId, userId) {
    const row = this.db.get(
      'SELECT id FROM creator_profiles WHERE guild_id = ? AND user_id = ?',
      [guildId, userId]
    );
    return !!row;
  }

  /**
   * Idempotently registers a new creator profile.
   * If a profile already exists, returns the duplicate status along with the existing record.
   * 
   * @param {string} guildId - Target Discord Guild ID 
   * @param {string} userId - Target Discord User ID 
   * @param {string} displayName - The display name for the profile 
   * @param {string} status - Initial profile status (Default: 'pending')
   * @returns {Object} Object indicating duplication status and mapped record data
   */
  createCreator(guildId, userId, displayName, status = 'pending') {
    const now = new Date().toISOString();

    const existing = this.db.get(
      `SELECT id, guild_id, user_id, display_name, bio, status, created_at, updated_at 
       FROM creator_profiles 
       WHERE guild_id = ? AND user_id = ?`,
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
      `SELECT id, guild_id, user_id, display_name, bio, status, created_at, updated_at 
       FROM creator_profiles 
       WHERE guild_id = ? AND user_id = ?`,
      [guildId, userId]
    );

    return { duplicate: false, creator: this.mapRow(row) };
  }

  /**
   * Retrieves a creator profile from the database layer.
   * 
   * @param {string} guildId - Target Discord Guild ID 
   * @param {string} userId - Target Discord User ID 
   * @returns {Object|null} Mapped data values or null if not found
   */
  getCreator(guildId, userId) {
    const row = this.db.get(
      `SELECT id, guild_id, user_id, display_name, bio, status, created_at, updated_at 
       FROM creator_profiles 
       WHERE guild_id = ? AND user_id = ?`,
      [guildId, userId]
    );

    if (!row) return null;
    return this.mapRow(row);
  }

  /**
   * Alias mapper matching helper contracts.
   */
  getCreatorByUser(guildId, userId) {
    return this.getCreator(guildId, userId);
  }

  /**
   * Modifies a creator profile status following strict constraint tags.
   * Validates state changes safely against pending, active, and suspended buckets.
   * 
   * @param {string} guildId - Target Discord Guild ID 
   * @param {string} userId - Target Discord User ID 
   * @param {string} status - New state string ('pending' | 'active' | 'suspended')
   * @returns {Object} Mapped data tracking values
   */
  updateCreatorStatus(guildId, userId, status) {
    if (status !== 'pending' && status !== 'active' && status !== 'suspended') {
      throw new Error('Invalid creator status: ' + status);
    }

    const ts = new Date().toISOString();
    this.db.exec(
      `UPDATE creator_profiles 
       SET status = ?, updated_at = ? 
       WHERE guild_id = ? AND user_id = ?`,
      [status, ts, guildId, userId]
    );

    const row = this.db.get(
      `SELECT id, guild_id, user_id, display_name, bio, status, created_at, updated_at 
       FROM creator_profiles 
       WHERE guild_id = ? AND user_id = ?`,
      [guildId, userId]
    );

    return this.mapRow(row);
  }

  /**
   * Normalizes raw snake_case database records into camelCase configuration fields.
   * @private
   */
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

// Cleaned up named export object format to perfectly match Source 8's exact import structure
module.exports = { 
  CreatorRepository 
};
