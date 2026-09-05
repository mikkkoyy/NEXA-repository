const ping = require('./ping');
const help = require('./help');
const profile = require('./profile');
const moderation_warn = require('./moderation_warn');
const moderation_warnings = require('./moderation_warnings');
const moderation_timeout = require('./moderation_timeout');
const moderation_kick = require('./moderation_kick');
const moderation_ban = require('./moderation_ban');
const settings = require('./settings');
const analytics = require('./analytics');
const premium = require('./premium');
const quests = require('./quests');
const quest = require('./quest');
const collectibles = require('./collectibles');
const collectible = require('./collectible');
const achievements = require('./achievements');
const achievement = require('./achievement');
const balance = require('./balance');
const creator = require('./creator');

const commands = [
  ping, help, profile, moderation_warn, moderation_warnings, moderation_timeout, moderation_kick, moderation_ban, settings, premium, analytics, quests, quest, collectibles, collectible, achievements, achievement, balance, creator
];

module.exports = {
  commands,
  getCommand: (name) => commands.find(c => c.data.name === name)
};