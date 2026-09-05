// Collectible definitions used to seed each guild's collectible set.
// Definitions are easy to change here; the engine consumes them generically.

const RarityCommon = "common";
const RarityUncommon = "uncommon";
const RarityRare = "rare";

// CollectibleDef is a default collectible template used to seed each guild's collection.
function DefaultCollectibles() {
  return [
    {
      Key: "moon_shard",
      Name: "Moon Shard",
      Description: "A pale fragment said to appear when the server grows unusually quiet.",
      Rarity: RarityCommon,
      Icon: "🌙"
    },
    {
      Key: "ember_core",
      Name: "Ember Core",
      Description: "A warm fragment carrying the memory of something that burned long ago.",
      Rarity: RarityUncommon,
      Icon: "🔥"
    },
    {
      Key: "static_relic",
      Name: "Static Relic",
      Description: "A strange relic that seems to react whenever NEXA notices unusual activity.",
      Rarity: RarityRare,
      Icon: "⚡"
    }
  ];
}

module.exports = { DefaultCollectibles };