const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot('7990738699:AAFfoPA4VGO_90DyQauHNiwbHnfwOTmfbgU', { polling: false });
const chatId = '8305086804';

const message = `
🟢 *PROFESSIONAL BOT ACTIVE*

✅ *Scan #1 Complete*
⏰ Next scan in ~1 minute

📊 *New Alert Format:*
Each scan now shows:

1️⃣ Token prices on each DEX
2️⃣ Liquidity per pool  
3️⃣ Arbitrage buy/sell prices
4️⃣ Price spread %
5️⃣ Flash loan amount
6️⃣ Expected profit
7️⃣ Flash loan fee (0.05%)
8️⃣ Gas cost (~$15)
9️⃣ NET PROFIT (after ALL costs)
🔟 Is it profitable? (YES/NO)

⏰ *Waiting for Scan #2...*

This will show you EXACTLY what profit you'd make if you execute the trade!
`;

bot.sendMessage(chatId, message, { parse_mode: 'Markdown' })
  .then(() => {
    console.log('✅ Status sent!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
