const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { XPForLevel } = require('../identity/model');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('View your NEXA profile'),
  async execute(interaction) {
    const guildID = interaction.guildId;
    const userID = interaction.user.id;
    const username = interaction.user.username;
    const displayName = interaction.member?.nickname || interaction.user.displayName || username;

    const profile = await interaction.client.identityService.profile(
      interaction,
      guildID,
      userID,
      username,
      displayName
    );

    const currentXP = profile.xp;
    const currentLevel = profile.level;
    const needed = XPForLevel(currentLevel + 1);
    const currentLevelBase = XPForLevel(currentLevel);
    const progress = currentXP - currentLevelBase;

    const embed = new EmbedBuilder()
      .setTitle(`${profile.displayName || profile.username}'s Profile`)
      .setColor(0x5865F2)
      .addFields(
        { name: 'Level', value: `${currentLevel}`, inline: true },
        { name: 'XP', value: `${currentXP.toLocaleString()} / ${needed.toLocaleString()}`, inline: true },
        { name: 'Reputation', value: `${profile.reputation}`, inline: true }
      )
      .addFields(
        { name: 'Messages', value: `${profile.messageCount.toLocaleString()}`, inline: true },
        { name: 'Progress', value: `${progress}/${needed - currentLevelBase}`, inline: false }
      );

    if (profile.firstSeenAt) {
      embed.addFields({ name: 'Member Since', value: profile.firstSeenAt.toLocaleDateString(), inline: true });
    }

    await interaction.reply({ embeds: [embed] });
  }
};