const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const { ObjectiveMessageCount, StatusCompleted } = require('../quests/model');
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

function questListLines(all) {
  const lines = [];
  for (const mq of all) {
    if (lines.length > 0) lines.push('');
    let name = mq.name;
    if (mq.status === StatusCompleted) name += '  ✓';
    lines.push(name);
    lines.push('  ' + formatProgressText(mq));
    lines.push(`  Progress: ${mq.progress} / ${mq.target}`);
    lines.push(`  Reward: +${mq.xp} XP`);
  }
  return lines.length ? lines : ['No quests are available yet.'];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('quests')
    .setDescription('Show your available NEXA quests.')
    .setDMPermission(false),
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

    const quests = await service.getMemberQuests(interaction.guildId, user.id);
    const lines = questListLines(quests);

    const embed = new EmbedBuilder()
      .setDescription('```\n' + lines.join('\n') + '\n```')
      .setColor(questColor)
      .setFooter({ text: 'NEXA • Your server\'s world engine' });

    return interaction.reply({ embeds: [embed] });
  }
};