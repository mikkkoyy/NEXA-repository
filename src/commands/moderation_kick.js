const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member.')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption(option =>
      option.setName('user').setDescription('User to kick').setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason').setDescription('Reason for the kick').setRequired(false)
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

    await guild.members.kick(target, reason);

    const service = interaction.client.moderationService;
    if (!service) {
      return interaction.reply({ content: 'Moderation system unavailable.', ephemeral: true });
    }

    service.warn(guild.id, target.id, moderator.id, moderator.displayName || moderator.user.name, `Kicked: ${reason}`);

    return interaction.reply({ content: `Kicked ${target.tag}: ${reason}` });
  }
};