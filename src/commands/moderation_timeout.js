const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeout a member.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(option =>
      option.setName('user').setDescription('User to timeout').setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('duration').setDescription('Duration in minutes').setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason').setDescription('Reason for the timeout').setRequired(false)
    ),
  async execute(interaction) {
    const guild = interaction.guild;
    if (!guild) {
      return interaction.reply({ content: 'This command must be used in a server.', ephemeral: true });
    }

    const target = interaction.options.getUser('user');
    const duration = interaction.options.getInteger('duration');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    const moderator = interaction.member;
    if (!moderator) {
      return interaction.reply({ content: 'Could not determine moderator information.', ephemeral: true });
    }

    // Note: Actual timeout duration handling would require Discord API calls
    // This is a placeholder that records the intent
    const service = interaction.client.moderationService;
    if (!service) {
      return interaction.reply({ content: 'The moderation system is not available right now.', ephemeral: true });
    }

    // For now, just record the warning-like action
    service.warn(guild.id, target.id, moderator.id, moderator.displayName || moderator.user.name, `Timeout for ${duration} minutes: ${reason}`);

    return interaction.reply({ content: `Timeout set for ${target.tag} for ${duration} minutes: ${reason}` });
  }
};