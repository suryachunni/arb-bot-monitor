const https = require('https');

const botToken = '7990738699:AAFfoPA4VGO_90DyQauHNiwbHnfwOTmfbgU';
const chatId = '8305086804';

console.log('Testing Telegram...\n');
console.log('1. Checking bot info...');

// Get bot info
https.get(`https://api.telegram.org/bot${botToken}/getMe`, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const result = JSON.parse(data);
    if (result.ok) {
      console.log('✅ Bot is valid: @' + result.result.username);
      console.log('   Bot ID:', result.result.id);
      
      // Now try to send a message
      console.log('\n2. Sending test message...');
      
      const message = '🔴 URGENT TEST\n\nIf you see this, Telegram works!\n\nReply "yes" if you got this message.';
      
      const postData = JSON.stringify({
        chat_id: chatId,
        text: message
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
          console.log('\nAPI Response:', JSON.stringify(result2, null, 2));
          
          if (result2.ok) {
            console.log('\n✅ MESSAGE SENT SUCCESSFULLY!');
            console.log('Message ID:', result2.result.message_id);
            console.log('\n📱 CHECK YOUR TELEGRAM NOW!');
            console.log('Search for: @Rise2203_bot');
          } else {
            console.log('\n❌ FAILED TO SEND:');
            console.log('Error Code:', result2.error_code);
            console.log('Description:', result2.description);
            
            if (result2.error_code === 400) {
              console.log('\n⚠️  POSSIBLE ISSUES:');
              console.log('1. You need to START the bot first');
              console.log('   - Open Telegram');
              console.log('   - Search for @Rise2203_bot');
              console.log('   - Click START button');
              console.log('');
              console.log('2. Wrong Chat ID');
              console.log('   - Open @userinfobot in Telegram');
              console.log('   - Send any message');
              console.log('   - It will show your correct Chat ID');
            }
          }
        });
      });
      
      req.on('error', (e) => {
        console.error('❌ Request failed:', e.message);
      });
      
      req.write(postData);
      req.end();
      
    } else {
      console.log('❌ Bot token invalid');
    }
  });
}).on('error', (e) => {
  console.error('❌ Failed:', e.message);
});
