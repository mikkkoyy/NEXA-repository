const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { StatusAvailable, StatusActive, StatusCompleted, ObjectiveMessageCount } = require('../achievements/model');
const { DefaultAchievements } = require('../achievements/seed');
const questColor = 0x6c5ce7;

function formatProgressText(ma) {
  switch (ma.objectiveType) {
    case ObjectiveMessageCount:
      if (ma.target === 1) return 'Send 1 message';
      return `Send ${ma.target} messages`;
    default:
      return '';
  }
}

function achievementStatusLabel(status) {
  switch (status) {
    case StatusAvailable: return 'AVAILABLE';
    case StatusActive: return 'ACTIVE';
    case StatusCompleted: return 'COMPLETED';
    default: return status;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('achievement')
    .setDescription('Show your NEXA achievement information.')
    .setDMPermission(false)
    .addStringOption(option =>
      option
        .setName('achievement')
        .setDescription('Achievement to inspect (optional).')
        .setRequired(false)
        .addChoices(...DefaultAchievements().map(d => ({ name: d.Name, value: d.Key })))
    ),
  async execute(interaction) {
    const service = interaction.client.achievementService;
    if (!service) {
      return interaction.reply({ content: 'The achievements system is not available right now.', ephemeral: true });
    }
    if (!interaction.guildId) {
      return interaction.reply({ content: 'Achievements live inside servers. Try this command in a guild.', ephemeral: true });
    }

    const user = interaction.user;
    if (!user) {
      return interaction.reply({ content: 'Could not determine user information.', ephemeral: true });
    }

    const key = interaction.options.getString('achievement') || '';

    if (key) {
      return handleAchievementDetail(interaction, service, interaction.guildId, user.id, key);
    }
    return handleAchievementSummary(interaction, service, interaction.guildId, user.id);
  }
};

async function handleAchievementDetail(interaction, service, guildID, userID, key) {
  const ma = await service.getMemberAchievement(guildID, userID, key);
  if (!ma) {
    return interaction.reply({ content: `No achievement named "${key}" was found. Try \`/achievements\` to see what is available.`, ephemeral: true });
  }

  const lines = [
    ma.name,
    '  ' + ma.description,
    '  ' + formatProgressText(ma),
    `  Progress: ${ma.progress} / ${ma.target}`,
    `  Reward: +${ma.rewardXP} XP`,
    `  Status: ${achievementStatusLabel(ma.status)}`
  ];

  const embed = new EmbedBuilder()
    .setDescription('```\n' + lines.join('\n') + '\n```')
    .setColor(questColor)
    .setFooter({ text: 'NEXA • Achievement details' });

  return interaction.reply({ embeds: [embed] });
}

async function handleAchievementSummary(interaction, service, guildID, userID) {
  const memberAchievements = await service.getMemberAchievements(guildID, userID);
  let active = 0, completed = 0;
  for (const ma of memberAchievements) {
    if (ma.status === StatusActive || ma.status === StatusAvailable) active++;
    if (ma.status === StatusCompleted) completed++;
  }

  const lines = [
    `Active achievements: ${active}`,
    `Completed: ${completed}`
  ];
  for (const ma of memberAchievements) {
    if (ma.status === StatusActive || ma.status === StatusAvailable) {
      lines.push(`  • ${ma.name} (${ma.progress}/${ma.target})`);
    }
  }
  if (active === 0) {
    lines.push('  No achievements in progress.');
  }
  lines.push('');
  lines.push('Use `/achievements` for full list.');

  const embed = new EmbedBuilder()
    .setDescription('```\n' + lines.join('\n') + '\n```')
    .setColor(questColor)
    .setFooter({ text: 'NEXA • Your server\'s world engine' });

  return interaction.reply({ embeds: [embed] });
}