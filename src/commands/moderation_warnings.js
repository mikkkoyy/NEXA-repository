const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('Show a member\'s warnings.')
    .addUserOption(option =>
      option.setName('user').setDescription('User to check warnings for').setRequired(false)
    ),
  async execute(interaction) {
    const guild = interaction.guild;
    if (!guild) {
      return interaction.reply({ content: 'This command must be used in a server.', ephemeral: true });
    }

    const target = interaction.options.getUser('user') || interaction.user;

    const service = interaction.client.moderationService;
    if (!service) {
      return interaction.reply({ content: 'The moderation system is not available right now.', ephemeral: true });
    }

    const warningList = service.warnings(guild.id, target.id);

    if (warningList.length === 0) {
      return interaction.reply({ content: `${target.tag} has no warnings.` });
    }

    const lines = warningList.map(w => `${w.moderatorName}: ${w.reason} (${w.createdAt})`).join('\n');
    return interaction.reply({ content: `Warnings for ${target.tag}:\n${lines}` });
  }
};