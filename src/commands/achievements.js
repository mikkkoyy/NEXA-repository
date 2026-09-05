const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { StatusAvailable, StatusActive, StatusCompleted, ObjectiveMessageCount } = require('../achievements/model');
const questColor = 0x6c5ce7;

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
    .setName('achievements')
    .setDescription("Show your NEXA achievements.")
    .setDMPermission(false),
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

    const memberAchievements = await service.getMemberAchievements(interaction.guildId, user.id);
    let active = 0, completed = 0;
    for (const ma of memberAchievements) {
      if (ma.status === StatusActive || ma.status === StatusAvailable) active++;
      if (ma.status === StatusCompleted) completed++;
    }

    const lines = [];
    for (const ma of memberAchievements) {
      const icon = ma.status === StatusCompleted ? '✅' : ma.status === StatusActive ? '⏳' : '⬜';
      lines.push(`${icon} ${ma.name}`);
      lines.push(`  ${ma.progress} / ${ma.target}`);
      lines.push(`  Reward: +${ma.rewardXP} XP`);
      lines.push(`  Status: ${achievementStatusLabel(ma.status)}`);
    }
    if (active === 0 && completed === 0) {
      lines.push('  No achievements yet. Complete quests to earn them.');
    }
    lines.push('');
    lines.push('Use `/achievement` for details.');

    const embed = new EmbedBuilder()
      .setDescription('```\n' + lines.join('\n') + '\n```')
      .setColor(questColor)
      .setFooter({ text: 'NEXA • Your server\'s world engine' });

    return interaction.reply({ embeds: [embed] });
  }
};