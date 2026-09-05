const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { CurrencyName, CurrencySymbol } = require('../economy/model');
const questColor = 0x6c5ce7;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription(`Check your NEXA ${CurrencyName} balance.`)
    .setDMPermission(false),
  async execute(interaction) {
    const service = interaction.client.economyService;
    if (!service) {
      return interaction.reply({ content: 'The economy system is not available right now.', ephemeral: true });
    }
    if (!interaction.guildId) {
      return interaction.reply({ content: 'Economy lives inside servers. Try this command in a guild.', ephemeral: true });
    }

    const user = interaction.user;
    if (!user) {
      return interaction.reply({ content: 'Could not determine user information.', ephemeral: true });
    }

    const balance = service.getBalance(interaction.guildId, user.id);
    const wallet = service.getWallet(interaction.guildId, user.id);
    const txCount = service.repo.getTransactionCount(interaction.guildId, user.id);

    const lines = [
      `Balance: ${CurrencySymbol} ${balance.toLocaleString()} ${CurrencyName}`,
      `Transactions: ${txCount}`
    ];

    if (wallet && wallet.createdAt) {
      lines.push(`Account created: ${wallet.createdAt.toISOString().split('T')[0]}`);
    }

    const embed = new EmbedBuilder()
      .setDescription('```\n' + lines.join('\n') + '\n```')
      .setColor(questColor)
      .setFooter({ text: 'NEXA • Your server\'s world engine' });

    return interaction.reply({ embeds: [embed] });
  }
};