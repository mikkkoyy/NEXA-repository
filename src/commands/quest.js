const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { StatusActive, StatusCompleted, StatusExpired, ObjectiveMessageCount } = require('../quests/model');
const { DefaultQuests } = require('../quests/seed');
const questColor = 0x6c5ce7;

function formatProgressText(mq) {
  switch (mq.objectiveType) {
    case ObjectiveMessageCount:
      if (mq.target === 1) return 'Send 1 message';
      return `Send ${mq.target} messages`;
    default:
      return '';
  }
}

function questStatusLabel(status) {
  switch (status) {
    case StatusActive: return 'ACTIVE';
    case StatusCompleted: return 'COMPLETED';
    case StatusExpired: return 'EXPIRED';
    default: return status;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('quest')
    .setDescription('Show your NEXA quest information.')
    .setDMPermission(false)
    .addStringOption(option =>
      option
        .setName('quest')
        .setDescription('Quest to inspect (optional).')
        .setRequired(false)
        .addChoices(...DefaultQuests().map(d => ({ name: d.Name, value: d.Key })))
    ),
  async execute(interaction) {
    const service = interaction.client.questService;
    if (!service) {
      return interaction.reply({ content: 'The quest system is not available right now.', ephemeral: true });
    }
    if (!interaction.guildId) {
      return interaction.reply({ content: 'Quests live inside servers. Try this command in a guild.', ephemeral: true });
    }

    const user = interaction.user;
    if (!user) {
      return interaction.reply({ content: 'Could not determine user information.', ephemeral: true });
    }

    const key = interaction.options.getString('quest') || '';

    if (key) {
      return handleQuestDetail(interaction, service, interaction.guildId, user.id, key);
    }
    return handleQuestSummary(interaction, service, interaction.guildId, user.id);
  }
};

async function handleQuestDetail(interaction, service, guildID, userID, key) {
  const mq = await service.getMemberQuest(guildID, userID, key);
  if (!mq) {
    return interaction.reply({ content: `No quest named "${key}" was found. Try \`quests\` to see what is available.`, ephemeral: true });
  }

  const lines = [
    mq.name,
    '  ' + mq.description,
    '  ' + formatProgressText(mq),
    `  Progress: ${mq.progress} / ${mq.target}`,
    `  Reward: +${mq.xp} XP`,
    `  Status: ${questStatusLabel(mq.status)}`
  ];
  if (mq.expiresAt && mq.status !== StatusCompleted) {
    lines.push(`  Expires: ${mq.expiresAt.toISOString().split('T')[0]}`);
  }

  const embed = new EmbedBuilder()
    .setDescription('```\n' + lines.join('\n') + '\n```')
    .setColor(questColor)
    .setFooter({ text: 'NEXA • Quest details' });

  return interaction.reply({ embeds: [embed] });
}

async function handleQuestSummary(interaction, service, guildID, userID) {
  const memberQuests = await service.getMemberQuests(guildID, userID);
  let active = 0, completed = 0;
  for (const mq of memberQuests) {
    if (mq.status === StatusActive) active++;
    if (mq.status === StatusCompleted) completed++;
  }

  const lines = [
    `Active quests: ${active}`,
    `Completed: ${completed}`
  ];
  for (const mq of memberQuests) {
    if (mq.status === StatusActive) {
      lines.push(`  • ${mq.name} (${mq.progress}/${mq.target})`);
    }
  }
  if (active === 0) {
    lines.push('  No active quests right now.');
  }
  lines.push('');
  lines.push('Use `/quests` for full details.');

  const embed = new EmbedBuilder()
    .setDescription('```\n' + lines.join('\n') + '\n```')
    .setColor(questColor)
    .setFooter({ text: 'NEXA • Your server\'s world engine' });

  return interaction.reply({ embeds: [embed] });
}