const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot('7990738699:AAFfoPA4VGO_90DyQauHNiwbHnfwOTmfbgU', { polling: false });
const chatId = '8305086804';

const message = `
🔄 *BOT UPGRADING TO PROFESSIONAL MODE*

Old bot stopped (Scan #13 was last)

New features:
✅ Full profit calculations
✅ Flash loan amount shown
✅ All costs breakdown (loan fee + gas)
✅ NET PROFIT after everything
✅ Clear buy/sell recommendations
✅ Liquidity validation
✅ Systematic alerts

📊 *What You'll Now See:*

For each arbitrage opportunity:
1. Prices on each DEX
2. Liquidity per pool
3. Buy price vs Sell price
4. Spread %
5. Flash loan amount
6. Expected profit
7. Flash loan fee (0.05%)
8. Gas cost (~$15)
9. NET PROFIT (after all costs)
10. Is it profitable? YES/NO

⏰ Starting professional bot in 10 seconds...
`;

bot.sendMessage(chatId, message, { parse_mode: 'Markdown' })
  .then(() => {
    console.log('✅ Upgrade notice sent!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
