const http = require('http');
const crypto = require('crypto');

// Configure target and secret via env
const webhookUrl = process.env.WEBHOOK_URL || 'http://localhost:5000/api/payments/razorpay/webhook';
const secret = process.env.RAZORPAY_KEY_SECRET || 'test_secret';

// Example razorpay-like payload
const payload = {
  event: 'payment.captured',
  payload: {
    payment: {
      entity: {
        id: 'pay_test_12345',
        order_id: 'order_test_12345',
        status: 'captured',
        amount: 10000
      }
    },
    order: {
      entity: {
        id: 'order_test_12345',
        notes: { orderId: 'REPLACE_WITH_INTERNAL_ORDER_ID' }
      }
    }
  }
};

const raw = Buffer.from(JSON.stringify(payload));
const signature = crypto.createHmac('sha256', secret).update(raw).digest('hex');

const url = new URL(webhookUrl);

const options = {
  hostname: url.hostname,
  port: url.port || 80,
  path: url.pathname + (url.search || ''),
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': raw.length,
    'x-razorpay-signature': signature
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', data);
  });
});

req.on('error', (e) => console.error('Request error', e));
req.write(raw);
req.end();

// Usage: WEBHOOK_URL=http://localhost:5000/api/payments/razorpay/webhook RAZORPAY_KEY_SECRET=your_secret node sendWebhookTest.js
