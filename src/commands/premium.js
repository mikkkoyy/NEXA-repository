const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const premiumColor = 0xf5c542;

const formatDate = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

const formatPhp = (pricePhp) => `₱${Number(pricePhp).toLocaleString('en-US')}`;

function buildPlansLines(plans) {
  return plans
    .filter(p => p.enabled)
    .map(p => `${p.name.padEnd(12)}${formatPhp(p.pricePhp)}  ${p.durationDays} days`);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('premium')
    .setDescription('NEXA Premium: status, plans, and purchase.')
    .setDMPermission(false)
    .addSubcommand(subcommand =>
      subcommand.setName('status')
        .setDescription('Show your NEXA Premium status.')
    )
    .addSubcommand(subcommand =>
      subcommand.setName('plans')
        .setDescription('Show available NEXA Premium plans and benefits.')
    )
    .addSubcommand(subcommand =>
      subcommand.setName('buy')
        .setDescription('Purchase NEXA Premium.')
        .addStringOption(option =>
          option.setName('plan')
            .setDescription('The Premium plan to purchase.')
            .setRequired(true)
            .addChoices(
              { name: 'Monthly (₱49)', value: 'premium_monthly' },
              { name: 'Quarterly (₱129)', value: 'premium_quarterly' },
              { name: 'Yearly (₱399)', value: 'premium_yearly' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand.setName('payment-status')
        .setDescription('Show the status of your Premium payment by its reference.')
        .addStringOption(option =>
          option.setName('reference').setDescription('The payment reference returned by /premium buy.').setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand.setName('test-activate')
        .setDescription('Activate a short Premium entitlement for testing (test mode only).')
        .addIntegerOption(option =>
          option.setName('duration').setDescription('Length in days (1-90)').setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand.setName('claim')
        .setDescription('Claim your daily Premium economy bonus.')
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

    const guildID = guild.id;
    const userID = interaction.user.id;
    const plans = service.getPlans();

    switch (subcommand) {
      case 'status': {
        const status = service.getStatus(guildID, userID);

        if (!status.active) {
          const lines = [
            'Status: Not active',
            '',
            'Become a NEXA Premium member to unlock:',
            `\u2022 ${service.getConfig().benefits.xpMultiplier}x XP`,
            `\u2022 ${service.getConfig().benefits.reputationMultiplier}x Reputation`,
            '\u2022 Daily economy bonus',
            '',
            `Use /premium buy to get started.`
          ];

          const embed = new EmbedBuilder()
            .setTitle('NEXA PREMIUM')
            .setColor(premiumColor)
            .setDescription('```\n' + lines.join('\n') + '\n```');
          return interaction.reply({ embeds: [embed] });
        }

        const now = new Date();
        const entitlement = status.entitlement;
        const remainingDays = Math.max(1, Math.ceil((entitlement.expiresAt - now) / 86400000));
        const benefits = service.getConfig().benefits;

        const lines = [
          'Status: Active',
          `Plan: ${status.plan ? status.plan.name : 'Premium'}`,
          `Active since: ${formatDate(entitlement.startedAt)}`,
          `Expires: ${formatDate(entitlement.expiresAt)}`,
          `Remaining: ${remainingDays} day${remainingDays === 1 ? '' : 's'}`,
          '',
          'Premium Benefits',
          `\u2022 ${benefits.xpMultiplier}x XP`,
          `\u2022 ${benefits.reputationMultiplier}x Reputation`,
          '\u2022 Daily economy bonus'
        ];

        const embed = new EmbedBuilder()
          .setTitle('NEXA PREMIUM')
          .setColor(premiumColor)
          .setDescription('```\n' + lines.join('\n') + '\n```');
        return interaction.reply({ embeds: [embed] });
      }

      case 'plans': {
        const lines = [
          ...buildPlansLines(plans),
          '',
          'Premium Benefits',
          `\u2022 ${service.getConfig().benefits.xpMultiplier}x XP`,
          `\u2022 ${service.getConfig().benefits.reputationMultiplier}x Reputation`,
          '\u2022 Daily economy bonus',
          '',
          'How to purchase:',
          'Run /premium buy and choose a plan.'
        ];

        const embed = new EmbedBuilder()
          .setTitle('NEXA PREMIUM PLANS')
          .setColor(premiumColor)
          .setDescription('```\n' + lines.join('\n') + '\n```');
        return interaction.reply({ embeds: [embed] });
      }

      case 'buy': {
        const planKey = interaction.options.getString('plan');
        const paymentsService = interaction.client.paymentsService;
        if (!paymentsService) {
          return interaction.reply({ content: 'The payment system is not available right now.', ephemeral: true });
        }

        const plan = service.getPlan(planKey);
        if (!plan || !plan.enabled) {
          return interaction.reply({ content: 'That plan is not available. Use /premium plans to see the current plans.', ephemeral: true });
        }

        if (!paymentsService.testModeEnabled()) {
          return interaction.reply({
            content: 'Real-money payment processing is not connected yet. No charge or entitlement was created. Premium plans and payments are tracked via the payment system once a provider is connected.',
            ephemeral: true
          });
        }

        try {
          const { payment } = paymentsService.buyPremium(guildID, userID, planKey);
          const { activated } = paymentsService.confirmPayment(payment.providerPaymentID);

          const lines = [
            `Plan: ${plan.name} (${formatPhp(plan.pricePhp)}, ${plan.durationDays} days)`,
            `Status: ${activated ? 'Activated' : 'Pending'}`,
            `Reference: ${payment.providerPaymentID}`
          ];

          const embed = new EmbedBuilder()
            .setTitle('NEXA PREMIUM — PURCHASE')
            .setColor(premiumColor)
            .setDescription('```\n' + lines.join('\n') + '\n```');
          return interaction.reply({ embeds: [embed] });
        } catch (err) {
          return interaction.reply({ content: `Purchase failed: ${err.message}`, ephemeral: true });
        }
      }

      case 'payment-status': {
        const reference = interaction.options.getString('reference');
        const paymentsService = interaction.client.paymentsService;
        if (!paymentsService) {
          return interaction.reply({ content: 'The payment system is not available right now.', ephemeral: true });
        }

        const payment = paymentsService.getPayment(guildID, userID, reference);
        if (!payment) {
          return interaction.reply({ content: 'No payment with that reference was found for your account.', ephemeral: true });
        }

        const status = service.getStatus(guildID, userID);
        const lines = [
          `Reference: ${payment.providerPaymentID}`,
          `Status: ${payment.status}`,
          `Plan: ${payment.planKey}`,
          `Amount: ${formatPhp(payment.amountMinor / 100)}`,
          `Entitlement: ${status.active ? 'Active' : 'None'}`
        ];

        const embed = new EmbedBuilder()
          .setTitle('NEXA PREMIUM — PAYMENT STATUS')
          .setColor(premiumColor)
          .setDescription('```\n' + lines.join('\n') + '\n```');
        return interaction.reply({ embeds: [embed] });
      }

      case 'test-activate': {
        if (!service.testMode) {
          return interaction.reply({ content: 'Test mode is not enabled on this instance.', ephemeral: true });
        }

        const duration = interaction.options.getInteger('duration');
        if (duration < 1 || duration > 90) {
          return interaction.reply({ content: 'Duration must be between 1 and 90 days.', ephemeral: true });
        }

        try {
          const entitlement = service.testActivate(guildID, userID, duration);
          const lines = [
            'Status: Active (test)',
            'Plan: Premium',
            `Active since: ${formatDate(new Date())}`,
            `Expires: ${formatDate(entitlement.expiresAt)}`
          ];

          const embed = new EmbedBuilder()
            .setTitle('NEXA PREMIUM — TEST ACTIVE')
            .setColor(premiumColor)
            .setDescription('```\n' + lines.join('\n') + '\n```');
          return interaction.reply({ embeds: [embed] });
        } catch (err) {
          return interaction.reply({ content: `Activation failed: ${err.message}`, ephemeral: true });
        }
      }

      case 'claim': {
        try {
          const result = service.claimEconomyBonus(guildID, userID);
          if (!result.claimed) {
            const reason = result.reason === 'already_claimed'
              ? 'You have already claimed today\'s Premium bonus. Come back tomorrow!'
              : 'You need an active NEXA Premium entitlement to claim this bonus.';
            return interaction.reply({ content: reason, ephemeral: true });
          }

          const wallet = interaction.client.economyService
            ? interaction.client.economyService.getBalance(guildID, userID)
            : null;
          const lines = [
            `Claimed: ${result.amount} NEXA Coin`,
            `Date: ${result.date}`,
            ...(wallet !== null ? [`Balance: ${wallet.toLocaleString()} NEXA Coin`] : [])
          ];

          const embed = new EmbedBuilder()
            .setTitle('NEXA PREMIUM — DAILY BONUS')
            .setColor(premiumColor)
            .setDescription('```\n' + lines.join('\n') + '\n```');
          return interaction.reply({ embeds: [embed] });
        } catch (err) {
          return interaction.reply({ content: `Claim failed: ${err.message}`, ephemeral: true });
        }
      }

      default:
        return interaction.reply({ content: 'Unknown premium action.', ephemeral: true });
    }
  }
};