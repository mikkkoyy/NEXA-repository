// Collectible model and constants.
// Rarity levels. Descriptive only; no loot boxes or gambling in 004.
const RarityCommon = "common";
const RarityUncommon = "uncommon";
const RarityRare = "rare";
const RarityEpic = "epic";
const RarityLegendary = "legendary";

// Sentinels returned by the service to guide command behavior.
const ErrNoSuchCollectible = new Error("no such collectible");
const ErrAlreadyOwned = new Error("collectible already owned");

const errGuildRequired = new Error("guild id is required");
const errGuildUserRequired = new Error("guild id and user id are required");

// Collectible represents a guild's definition of a collectible (a row in `collectibles`).
function createCollectible(id, guildID, key, name, description, rarity, icon, enabled, createdAt, updatedAt) {
  return {
    id, guildID, key, name, description, rarity, icon, enabled, createdAt, updatedAt
  };
}

// MemberCollectible is a member's ownership of one collectible, joined with its
// definition so rendering needs no extra lookups.
function createMemberCollectible(id, guildID, userID, collectibleID, key, name, description, rarity, icon, source, obtainedAt, createdAt) {
  return {
    id, guildID, userID, collectibleID, key, name, description, rarity, icon, source, obtainedAt, createdAt
  };
}

// RarityLabel humanizes a rarity for display.
function rarityLabel(rarity) {
  switch (rarity) {
    case RarityCommon: return "Common";
    case RarityUncommon: return "Uncommon";
    case RarityRare: return "Rare";
    case RarityEpic: return "Epic";
    case RarityLegendary: return "Legendary";
    default: return rarity;
  }
}

// IconForRarity returns a fallback icon when the collectible has none.
function iconForRarity(rarity) {
  switch (rarity) {
    case RarityCommon: return "⚪";
    case RarityUncommon: return "🟢";
    case RarityRare: return "🔵";
    case RarityEpic: return "🟣";
    case RarityLegendary: return "⭐";
    default: return "❓";
  }
}

// DisplayIcon returns the collectible icon, falling back to a rarity-based icon.
function memberCollectibleDisplayIcon(mc) {
  if (mc.icon) {
    return mc.icon;
  }
  return iconForRarity(mc.rarity);
}

// Format time for storage (ISO string)
function formatTime(t) {
  return t.toISOString();
}

// Parse time from storage (ISO string)
function parseTime(raw) {
  return new Date(raw);
}

module.exports = {
  RarityCommon,
  RarityUncommon,
  RarityRare,
  RarityEpic,
  RarityLegendary,
  ErrNoSuchCollectible,
  ErrAlreadyOwned,
  errGuildRequired,
  errGuildUserRequired,
  createCollectible,
  createMemberCollectible,
  rarityLabel,
  iconForRarity,
  memberCollectibleDisplayIcon,
  formatTime,
  parseTime
};