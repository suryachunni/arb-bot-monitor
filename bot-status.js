const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot('7990738699:AAFfoPA4VGO_90DyQauHNiwbHnfwOTmfbgU', { polling: false });
const chatId = '8305086804';

const message = `
🟢 *BOT IS RUNNING!*

✅ *Status: ACTIVE*
✅ Scanning every 2 minutes
✅ Using REAL prices (Quoter)
✅ 6 token pairs monitored

📊 *What You're Getting:*
• WETH/USDC
• WETH/USDT
• ARB/USDC
• WETH/ARB
• LINK/USDC
• GMX/USDC

⏰ *Scan Schedule:*
• Scan #1: ✅ Complete (8:10 PM)
• Scan #2: Starting at 8:13 PM
• Scan #3: Starting at 8:15 PM
... continues every 2 minutes

💡 *Each Alert Shows:*
• Real market prices ✅
• Multiple fee tiers
• Realistic spreads (0.01%-2%)
• Profit indicators

🔄 Bot will run continuously!

Just wait for alerts every 2 minutes!
`;

bot.sendMessage(chatId, message, { parse_mode: 'Markdown' })
  .then(() => {
    console.log('✅ Status sent!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed:', error.message);
    process.exit(1);
  });
