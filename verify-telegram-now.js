const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot('7990738699:AAFfoPA4VGO_90DyQauHNiwbHnfwOTmfbgU', { polling: false });
const chatId = '8305086804';

const message = `
✅ *TELEGRAM VERIFICATION*

If you see this message, your Telegram is working perfectly!

🤖 *Bot Status:*
• Scan #1: ✅ Complete
• Detailed alerts: ✅ Enabled
• Next scan: ~1 minute

📱 *What You'll Get Every 2 Min:*
• Live prices from 3 token pairs
• Liquidity data per DEX
• Spread calculations
• Scan statistics

🔍 *Currently Scanning:*
• WETH/USDC
• WETH/ARB  
• ARB/USDC

✅ All data is LIVE from Arbitrum blockchain!

⏰ Scan #2 starting soon...
`;

bot.sendMessage(chatId, message, { parse_mode: 'Markdown' })
  .then(() => {
    console.log('✅ Verification message sent!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed:', error.message);
    process.exit(1);
  });
