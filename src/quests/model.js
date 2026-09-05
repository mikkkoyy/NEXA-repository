// Quest definitions and constants.
// Objective types NEXA understands. Only message_count is implemented for
// DISCORD-BOT-003; future objectives plug into the same model.

const ObjectiveMessageCount = 'message_count';

// Quest statuses.
const StatusActive    = 'active';
const StatusCompleted = 'completed';
const StatusExpired   = 'expired';

// Sentinels returned by the service to guide command behaviour.
const ErrNoSuchQuest   = new Error('no such quest');
const ErrNoActiveQuest = new Error('no active quest');

const errGuildRequired     = new Error('guild id is required');
const errGuildUserRequired = new Error('guild id and user id are required');

// Quest is one guild's persistent definition of a quest (a row in `quests`).
function createQuest(id, guildID, key, name, description, objectiveType, target, xp, durationSeconds, enabled, createdAt, updatedAt) {
  return {
    id, guildID, key, name, description, objectiveType,
    target, xp, durationSeconds, enabled, createdAt, updatedAt
  };
}

// MemberQuest is a member's progress against one quest, joined with its
// definition so rendering needs no extra lookups.
function createMemberQuest(id, guildID, userID, questID, key, name, description, objectiveType, target, xp, collectibleRewardKey, progress, status, startedAt, completedAt, expiresAt, rewardClaimed) {
  return {
    id, guildID, userID, questID, key, name, description, objectiveType,
    target, xp, collectibleRewardKey, progress, status, startedAt, completedAt, expiresAt, rewardClaimed
  };
}

function formatTime(t) {
  return t.toISOString();
}

function parseTime(raw) {
  return new Date(raw);
}

// Complete reports whether the quest has reached its target.
function memberQuestComplete(memberQuest) {
  return memberQuest.progress >= memberQuest.target;
}

// ProgressText renders the objective as a short human-readable phrase.
function memberQuestProgressText(memberQuest) {
  switch (memberQuest.objectiveType) {
    case ObjectiveMessageCount:
      if (memberQuest.target === 1) {
        return 'Send 1 message';
      }
      return `Send ${memberQuest.target} messages`;
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
  StatusActive,
  StatusCompleted,
  StatusExpired,
  ErrNoSuchQuest,
  ErrNoActiveQuest,
  errGuildRequired,
  errGuildUserRequired,
  createQuest,
  createMemberQuest,
  formatTime,
  parseTime,
  memberQuestComplete,
  memberQuestProgressText,
  nextProgress
};