const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a member.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMembers)
    .addUserOption(option =>
      option.setName('user').setDescription('User to warn').setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason').setDescription('Reason for the warning').setRequired(false)
    ),
  async execute(interaction) {
    const guild = interaction.guild;
    if (!guild) {
      return interaction.reply({ content: 'This command must be used in a server.', ephemeral: true });
    }

    const target = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    const moderator = interaction.member;
    if (!moderator) {
      return interaction.reply({ content: 'Could not determine moderator information.', ephemeral: true });
    }

    const service = interaction.client.moderationService;
    if (!service) {
      return interaction.reply({ content: 'The moderation system is not available right now.', ephemeral: true });
    }

    service.warn(guild.id, target.id, moderator.id, moderator.displayName || moderator.user.name, reason);

    return interaction.reply({ content: `Warning issued to ${target.tag} for: ${reason}` });
  }
};