const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot('7990738699:AAFfoPA4VGO_90DyQauHNiwbHnfwOTmfbgU', { polling: false });
const chatId = '8305086804';

console.log('Testing Telegram message...');

bot.sendMessage(chatId, '🔍 *TEST MESSAGE FROM BOT*\n\nIf you see this, Telegram is working!\n\nBot is initializing...', { parse_mode: 'Markdown' })
  .then(() => {
    console.log('✅ Message sent successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed to send:', error.message);
    process.exit(1);
  });
