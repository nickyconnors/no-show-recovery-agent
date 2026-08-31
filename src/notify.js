require('dotenv').config();

const nodemailer = require('nodemailer');

const { GMAIL_USER, GMAIL_APP_PASSWORD } = process.env;

function assertConfigured() {
  const missing = [];
  if (!GMAIL_USER) missing.push('GMAIL_USER');
  if (!GMAIL_APP_PASSWORD) missing.push('GMAIL_APP_PASSWORD');
  if (missing.length) {
    throw new Error(`Missing required .env values: ${missing.join(', ')}`);
  }
}

let transporter;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASSWORD,
      },
    });
  }
  return transporter;
}

/**
 * Sends a notification email via Gmail SMTP (App Password auth).
 * Stand-in for Twilio SMS until phone number verification clears — see CONTEXT.md.
 * @param {{ to: string, subject: string, body: string }} params
 */
async function sendNotification({ to, subject, body }) {
  assertConfigured();

  if (!to) {
    throw new Error('sendNotification requires a "to" address');
  }

  console.log(`[notify] Sending notification to ${to}...`);
  console.log(`[notify] Subject: ${subject}`);
  console.log(`[notify] Body: ${body}`);

  const info = await getTransporter().sendMail({
    from: GMAIL_USER,
    to,
    subject,
    text: body,
  });

  console.log(`[notify] Sent. messageId=${info.messageId}, response=${info.response}`);

  return info;
}

module.exports = { sendNotification };
