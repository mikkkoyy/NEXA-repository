const ObjectiveMessageCount = 'message_count';

const StatusAvailable  = 'available';
const StatusActive     = 'active';
const StatusCompleted  = 'completed';

const ErrNoSuchAchievement = new Error('no such achievement');

const errGuildRequired     = new Error('guild id is required');
const errGuildUserRequired = new Error('guild id and user id are required');

function createAchievement(id, guildID, key, name, description, objectiveType, target, rewardXP, enabled, createdAt, updatedAt) {
  return {
    id, guildID, key, name, description, objectiveType,
    target, rewardXP, enabled, createdAt, updatedAt
  };
}

function createMemberAchievement(id, guildID, userID, achievementID, key, name, description, objectiveType, target, rewardXP, progress, status, startedAt, completedAt, createdAt, updatedAt) {
  return {
    id, guildID, userID, achievementID, key, name, description, objectiveType,
    target, rewardXP, progress, status, startedAt, completedAt, createdAt, updatedAt
  };
}

function formatTime(t) {
  return t.toISOString();
}

function parseTime(raw) {
  return new Date(raw);
}

function memberAchievementComplete(ma) {
  return ma.progress >= ma.target;
}

function memberAchievementProgressText(ma) {
  switch (ma.objectiveType) {
    case ObjectiveMessageCount:
      if (ma.target === 1) return 'Send 1 message';
      return `Send ${ma.target} messages`;
    default:
      return '';
  }
}

function nextProgress(objectiveType, current, target) {
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

module.exports = {
  ObjectiveMessageCount,
  StatusAvailable,
  StatusActive,
  StatusCompleted,
  ErrNoSuchAchievement,
  errGuildRequired,
  errGuildUserRequired,
  createAchievement,
  createMemberAchievement,
  formatTime,
  parseTime,
  memberAchievementComplete,
  memberAchievementProgressText,
  nextProgress
};