const Database = require('../database/database');

class CreatorContentRepository {
  constructor(db) {
    this.db = db;
  }

  ensureSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS creator_content (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        creator_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        content_type TEXT NOT NULL DEFAULT 'text',
        status TEXT NOT NULL DEFAULT 'draft',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        published_at TEXT,
        UNIQUE(guild_id, creator_id, title),
        FOREIGN KEY (creator_id) REFERENCES creator_profiles(id) ON DELETE CASCADE
      )
    `);
  }

  createContent(guildId, creatorId, title, description, contentType = 'text') {
    const now = new Date().toISOString();

    const existing = this.db.get(
      'SELECT id, guild_id, creator_id, title, description, content_type, status, created_at, updated_at, published_at FROM creator_content WHERE guild_id = ? AND creator_id = ? AND title = ?',
      [guildId, creatorId, title]
    );

    if (existing) {
      return { duplicate: true, content: this.mapRow(existing) };
    }

    this.db.exec(
      `INSERT INTO creator_content
        (guild_id, creator_id, title, description, content_type, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [guildId, creatorId, title, description, contentType, 'draft', now, now]
    );

    const row = this.db.get(
      'SELECT id, guild_id, creator_id, title, description, content_type, status, created_at, updated_at, published_at FROM creator_content WHERE guild_id = ? AND creator_id = ? AND title = ?',
      [guildId, creatorId, title]
    );

    return { duplicate: false, content: this.mapRow(row) };
  }

  getContent(guildId, contentId) {
    const row = this.db.get(
      'SELECT id, guild_id, creator_id, title, description, content_type, status, created_at, updated_at, published_at FROM creator_content WHERE guild_id = ? AND id = ?',
      [guildId, contentId]
    );

    if (!row) return null;
    return this.mapRow(row);
  }

  getCreatorContent(guildId, creatorId) {
    const rows = this.db.all(
      'SELECT id, guild_id, creator_id, title, description, content_type, status, created_at, updated_at, published_at FROM creator_content WHERE guild_id = ? AND creator_id = ? ORDER BY created_at DESC',
      [guildId, creatorId]
    );

    return rows.map(row => this.mapRow(row));
  }

  updateContent(guildId, contentId, title, description) {
    const now = new Date().toISOString();

    const existing = this.db.get(
      'SELECT id FROM creator_content WHERE guild_id = ? AND id = ?',
      [guildId, contentId]
    );

    if (!existing) return { notFound: true };

    this.db.exec(
      `UPDATE creator_content SET title = ?, description = ?, updated_at = ? WHERE guild_id = ? AND id = ?`,
      [title, description, now, guildId, contentId]
    );

    const row = this.db.get(
      'SELECT id, guild_id, creator_id, title, description, content_type, status, created_at, updated_at, published_at FROM creator_content WHERE guild_id = ? AND id = ?',
      [guildId, contentId]
    );

    return { notFound: false, content: this.mapRow(row) };
  }

  publishContent(guildId, contentId) {
    const now = new Date().toISOString();

    const existing = this.db.get(
      'SELECT id, creator_id, status FROM creator_content WHERE guild_id = ? AND id = ?',
      [guildId, contentId]
    );

    if (!existing) return { notFound: true };

    if (existing.status === 'published') {
      return { alreadyPublished: true, content: this.mapRow(existing) };
    }

    this.db.exec(
      `UPDATE creator_content SET status = 'published', published_at = ? WHERE guild_id = ? AND id = ?`,
      [now, guildId, contentId]
    );

    const row = this.db.get(
      'SELECT id, guild_id, creator_id, title, description, content_type, status, created_at, updated_at, published_at FROM creator_content WHERE guild_id = ? AND id = ?',
      [guildId, contentId]
    );

    return { notFound: false, content: this.mapRow(row) };
  }

  unpublishContent(guildId, contentId) {
    const now = new Date().toISOString();

    const existing = this.db.get(
      'SELECT id, creator_id, status FROM creator_content WHERE guild_id = ? AND id = ?',
      [guildId, contentId]
    );

    if (!existing) return { notFound: true };

    if (existing.status === 'draft') {
      return { alreadyDraft: true, content: this.mapRow(existing) };
    }

    this.db.exec(
      `UPDATE creator_content SET status = 'draft', published_at = NULL WHERE guild_id = ? AND id = ?`,
      [guildId, contentId]
    );

    const row = this.db.get(
      'SELECT id, guild_id, creator_id, title, description, content_type, status, created_at, updated_at, published_at FROM creator_content WHERE guild_id = ? AND id = ?',
      [guildId, contentId]
    );

    return { notFound: false, content: this.mapRow(row) };
  }

  deleteContent(guildId, contentId) {
    const existing = this.db.get(
      'SELECT id, creator_id FROM creator_content WHERE guild_id = ? AND id = ?',
      [guildId, contentId]
    );

    if (!existing) return { notFound: true };

    this.db.exec(
      `DELETE FROM creator_content WHERE guild_id = ? AND id = ?`,
      [guildId, contentId]
    );

    return { notFound: false, deleted: true };
  }

  mapRow(row) {
    return {
      id: row.id,
      guildId: row.guild_id,
      creatorId: row.creator_id,
      title: row.title,
      description: row.description,
      contentType: row.content_type,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      publishedAt: row.published_at
    };
  }
}

module.exports = { CreatorContentRepository };