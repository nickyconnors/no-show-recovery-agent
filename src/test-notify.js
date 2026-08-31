require('dotenv').config();

const { sendNotification } = require('./notify');

// Sends a real test email to yourself (GMAIL_USER) unless a different address is passed.
// Usage: node src/test-notify.js [to_address]
const to = process.argv[2] || process.env.GMAIL_USER;

const sample = {
  to,
  subject: 'No-Show Recovery Agent — test notification',
  body: "Hey Jon! We missed you for your Men's haircut. No worries — life happens! We'd love to get you in this week. Just give us a shout to rebook.",
};

(async () => {
  console.log('=== Notify (Gmail) test ===');
  console.log(`Using sample data: ${JSON.stringify(sample)}`);

  try {
    await sendNotification(sample);

    console.log('=== Test complete: Notify module is working — check your inbox ===');
  } catch (err) {
    console.error('[test-notify] Failed:', err.message);
    process.exit(1);
  }
})();
