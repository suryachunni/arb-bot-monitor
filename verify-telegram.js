const https = require('https');

const botToken = '7990738699:AAFfoPA4VGO_90DyQauHNiwbHnfwOTmfbgU';
const chatId = '8305086804';

console.log('Testing Telegram configuration...\n');
console.log('Bot Token:', botToken);
console.log('Chat ID:', chatId);
console.log('\n1. Testing bot token validity...');

// Test 1: Get bot info
https.get(`https://api.telegram.org/bot${botToken}/getMe`, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const result = JSON.parse(data);
    if (result.ok) {
      console.log('✅ Bot token is VALID');
      console.log('   Bot name:', result.result.first_name);
      console.log('   Bot username: @' + result.result.username);
      
      // Test 2: Send message
      console.log('\n2. Testing message send...');
      const message = '🔍 *TELEGRAM TEST*\n\nIf you see this, everything works!\n\nBot is ready to scan.';
      const postData = JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown'
      });
      
      const options = {
        hostname: 'api.telegram.org',
        path: `/bot${botToken}/sendMessage`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': postData.length
        }
      };
      
      const req = https.request(options, (res2) => {
        let data2 = '';
        res2.on('data', chunk => data2 += chunk);
        res2.on('end', () => {
          const result2 = JSON.parse(data2);
          if (result2.ok) {
            console.log('✅ Message sent successfully!');
            console.log('   Message ID:', result2.result.message_id);
            console.log('\n📱 CHECK YOUR TELEGRAM NOW!');
          } else {
            console.log('❌ Failed to send message:');
            console.log('   Error:', result2.description);
            console.log('\n⚠️  POSSIBLE ISSUES:');
            console.log('   1. Chat ID is wrong');
            console.log('   2. You need to start the bot first (/start)');
            console.log('   3. Bot is blocked');
          }
        });
      });
      
      req.on('error', (e) => {
        console.error('❌ Request failed:', e.message);
      });
      
      req.write(postData);
      req.end();
      
    } else {
      console.log('❌ Bot token is INVALID');
      console.log('   Error:', result.description);
    }
  });
}).on('error', (e) => {
  console.error('❌ Request failed:', e.message);
});

