const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot('7990738699:AAFfoPA4VGO_90DyQauHNiwbHnfwOTmfbgU', { polling: false });
const chatId = '8305086804';

// Get recent messages
const message = `
📊 *CHECKING WHAT YOU RECEIVED*

Please reply with:
1. How many messages you got today?
2. What was the last message timestamp?
3. Are you seeing scan results?

This will help me troubleshoot!

Current time: ${new Date().toLocaleTimeString()}
`;

bot.sendMessage(chatId, message, { parse_mode: 'Markdown' })
  .then(() => {
    console.log('✅ Check message sent!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
