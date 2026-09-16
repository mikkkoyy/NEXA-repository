/**
 * src/creator/resolver.js
 *
 * Centralized Discord user ID -> creator profile mapping.
 *
 * NEXA uses three distinct identifiers that must never be treated as
 * interchangeable:
 *   - Discord user ID            (creator_profiles.user_id)
 *   - Creator profile ID         (creator_profiles.id)
 *   - Content/Product ID         (creator_content.id / creator_marketplace.id)
 *
 * All creator-facing services and repositories operate on the canonical
 * numeric creator profile ID. This module is the single place where a
 * Discord user ID is translated into that canonical profile ID.
 */

function resolveCreator(db, guildId, userId) {
  if (!db || !guildId || !userId) return null;
  const row = db.get(
    'SELECT id, guild_id, user_id, display_name, status FROM creator_profiles WHERE guild_id = ? AND user_id = ?',
    [guildId, userId]
  );
  if (!row) return null;
  return {
    id: row.id,
    guildId: row.guild_id,
    userId: row.user_id,
    displayName: row.display_name,
    status: row.status
  };
}

function resolveCreatorProfileId(db, guildId, userId) {
  const creator = resolveCreator(db, guildId, userId);
  return creator ? creator.id : null;
}

module.exports = { resolveCreator, resolveCreatorProfileId };