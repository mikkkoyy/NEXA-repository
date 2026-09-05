// Default quest definitions used to seed each guild's quest set.
// Definitions are easy to change here; the engine consumes them generically.

const QuestDef = {
  Key: null,
  Name: null,
  Description: null,
  Target: 0,
  XP: 0,
  CollectibleRewardKey: '',
  DurationSeconds: 0
};

// Objective returns the objective type every default quest uses for 003.
function Objective() {
  return 'message_count';
}

// DefaultQuests returns the initial quest set NEXA assigns to a guild.
function DefaultQuests() {
  return [
    {
      Key: 'first_steps',
      Name: 'First Steps',
      Description: 'Send your first message and begin your journey.',
      Target: 1,
      XP: 10,
      CollectibleRewardKey: 'moon_shard',
      DurationSeconds: 0
    },
    {
      Key: 'social_presence',
      Name: 'Social Presence',
      Description: 'Become an active presence in the server.',
      Target: 5,
      XP: 25,
      CollectibleRewardKey: '',
      DurationSeconds: 0
    },
    {
      Key: 'regular',
      Name: 'Regular',
      Description: 'Keep the conversation alive.',
      Target: 10,
      XP: 50,
      CollectibleRewardKey: '',
      DurationSeconds: 0
    }
  ];
}

module.exports = { DefaultQuests, Objective };