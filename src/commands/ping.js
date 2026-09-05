const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check if NEXA is online'),
  async execute(interaction) {
    await interaction.reply('NEXA is online.');
  }
};