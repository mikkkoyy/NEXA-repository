const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('premium')
    .setDescription('Show this server\'s Premium status and manage Premium.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(subcommand =>
      subcommand.setName('status')
        .setDescription('Show this server\'s Premium status.')
    )
    .addSubcommand(subcommand =>
      subcommand.setName('buy')
        .setDescription('Start a Premium purchase for this server.')
    )
    .addSubcommand(subcommand =>
      subcommand.setName('payment-status')
        .setDescription('Show the status of a Premium payment by its reference.')
        .addStringOption(option =>
          option.setName('reference').setDescription('The payment reference returned by /premium buy.').setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand.setName('test-activate')
        .setDescription('Activate a short Premium entitlement for testing (dev/test mode only).')
        .addIntegerOption(option =>
          option.setName('duration').setDescription('Length in days (1-90)').setRequired(true)
        )
    ),
  async execute(interaction) {
    const guild = interaction.guild;
    if (!guild) {
      return interaction.reply({ content: 'Premium lives inside servers. Try this command in a server.', ephemeral: true });
    }

    const subcommand = interaction.options.getSubcommand();
    const service = interaction.client.premiumService;
    if (!service) {
      return interaction.reply({ content: 'The premium system is not available right now.', ephemeral: true });
    }

    switch (subcommand) {
      case 'status': {
        const view = service.getGuildPremium(guild.id);
        if (!view) {
          const embed = new EmbedBuilder()
            .setTitle('NEXA PREMIUM')
            .setColor(0xf5c542)
            .setDescription('This server has no Premium entitlement. Premium is the default state.');
          return interaction.reply({ embeds: [embed] });
        }

        const lines = [
          `Plan: ${view.name}`,
          `Status: ${view.status}`,
          ...(view.expiresAt ? [`Expires: ${view.expiresAt.toLocaleDateString()}`] : [])
        ];

        const embed = new EmbedBuilder()
          .setTitle('NEXA PREMIUM')
          .setColor(0xf5c542)
          .setDescription('```\n' + lines.join('\n') + '\n```');
        return interaction.reply({ embeds: [embed] });
      }

      case 'buy': {
        // In a full implementation, this would integrate with the PaymentService
        // For now, we'll just inform the user
        return interaction.reply({ content: 'Premium purchase initiated. In a full implementation, this would redirect to a payment provider.' });
      }

      case 'payment-status': {
        const reference = interaction.options.getString('reference');
        if (!reference) {
          return interaction.reply({ content: 'A payment reference is required.', ephemeral: true });
        }
        // In a full implementation, this would check the payment status
        return interaction.reply({ content: `Payment status check for reference: ${reference}. In a full implementation, this would query the payment provider.` });
      }

      case 'test-activate': {
        if (!service.testMode) {
          return interaction.reply({ content: 'Test mode is not enabled on this instance.', ephemeral: true });
        }

        const duration = interaction.options.getInteger('duration');
        if (duration < 1 || duration > 90) {
          return interaction.reply({ content: 'Duration must be between 1 and 90 days.', ephemeral: true });
        }

        const result = service.activatePremium(guild.id, PlanKeyPremium, duration);
        if (result.error) {
          return interaction.reply({ content: result.error, ephemeral: true });
        }

        const view = service.getGuildPremium(guild.id);
        const lines = [
          `Plan: ${view.name}`,
          `Status: ${view.status}`,
          ...(view.expiresAt ? [`Expires: ${view.expiresAt.toLocaleDateString()}`] : [])
        ];

        const embed = new EmbedBuilder()
          .setTitle('NEXA PREMIUM — TEST ACTIVE')
          .setColor(0xf5c542)
          .setDescription('```\n' + lines.join('\n') + '\n```');
        return interaction.reply({ embeds: [embed] });
      }

      default:
        return interaction.reply({ content: 'Unknown premium action.', ephemeral: true });
    }
  }
};