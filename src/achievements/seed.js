// Default achievement definitions used to seed each guild's achievement set.
// Definitions are easy to change here; the engine consumes them generically.

const RarityCommon = "common";

// AchievementDef is a default achievement template used to seed each guild's achievement set.
function DefaultAchievements() {
  return [
    {
      Key: "first_steps",
      Name: "First Steps",
      Description: "Send your first message and begin your journey.",
      ObjectiveType: "message_count",
      Target: 1,
      RewardXP: 10,
      Enabled: true
    },
    {
      Key: "social_presence",
      Name: "Social Presence",
      Description: "Become an active presence in the server.",
      ObjectiveType: "message_count",
      Target: 5,
      RewardXP: 25,
      Enabled: true
    },
    {
      Key: "regular",
      Name: "Regular",
      Description: "Keep the conversation alive.",
      ObjectiveType: "message_count",
      Target: 10,
      RewardXP: 50,
      Enabled: true
    }
  ];
}

module.exports = { DefaultAchievements };