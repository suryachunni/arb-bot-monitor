const https = require('https');

const botToken = '7990738699:AAFfoPA4VGO_90DyQauHNiwbHnfwOTmfbgU';
const chatId = '8305086804';

console.log('Testing Telegram connection...\n');

const message = '🔴 URGENT TEST MESSAGE\n\nIf you see this, Telegram is working!\n\nTime: ' + new Date().toLocaleTimeString();

const postData = JSON.stringify({
  chat_id: String(chatId),
  text: String(message)
});

console.log('Sending to Chat ID:', chatId);
console.log('Message length:', message.length);
console.log('');

const options = {
  hostname: 'api.telegram.org',
  path: `/bot${botToken}/sendMessage`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const result = JSON.parse(data);
    
    console.log('Status Code:', res.statusCode);
    console.log('Response:', JSON.stringify(result, null, 2));
    
    if (result.ok) {
      console.log('\n✅ SUCCESS! Message sent!');
      console.log('Message ID:', result.result.message_id);
      console.log('\n📱 CHECK TELEGRAM NOW: @Rise2203_bot');
    } else {
      console.log('\n❌ FAILED!');
      console.log('Error:', result.description);
      
      if (result.description.includes('chat not found') || result.description.includes('user not found')) {
        console.log('\n🔧 FIX:');
        console.log('1. Open Telegram app');
        console.log('2. Search for: @Rise2203_bot');
        console.log('3. Click the bot');
        console.log('4. Press START button at bottom');
        console.log('5. Then run this test again');
      }
    }
  });
});

req.on('error', (e) => {
  console.error('Request error:', e.message);
});

req.write(postData);
req.end();
