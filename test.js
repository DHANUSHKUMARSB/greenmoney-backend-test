const https = require('https');

const data = JSON.stringify({ inputs: 'hello' });

const options = {
  hostname: 'router.huggingface.co',
  path: '/hf-inference/models/google/flan-t5-base',
  method: 'POST',
  headers: {
    'Authorization': 'Bearer hf_FakeTokenHere',
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(options, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log('STATUS:', res.statusCode, 'BODY:', body.substring(0, 200)));
});

req.write(data);
req.end();
