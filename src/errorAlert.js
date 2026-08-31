require('dotenv').config();

const { sendNotification } = require('./notify');

const { GMAIL_USER } = process.env;

/**
 * Emails a quick failure alert so a broken run doesn't go unnoticed. Reuses
 * the Gmail stand-in notification channel, sending to the same account it
 * sends from (GMAIL_USER) — this is an alert to the operator, not a customer
 * notification.
 * @param {Error} error
 * @param {string} [context] e.g. "scheduled run #3"
 */
async function sendErrorAlert(error, context = 'pipeline run') {
  console.error(`[errorAlert] ${context} failed:`, error.message);

  if (!GMAIL_USER) {
    console.error('[errorAlert] GMAIL_USER not configured — cannot send failure alert email.');
    return;
  }

  try {
    await sendNotification({
      to: GMAIL_USER,
      subject: `No-Show Recovery Agent — ${context} failed`,
      body: `The no-show recovery pipeline failed during: ${context}\n\nError: ${error.message}\n\nStack:\n${error.stack}`,
    });
    console.log('[errorAlert] Failure alert email sent.');
  } catch (alertErr) {
    console.error('[errorAlert] Failed to send failure alert email:', alertErr.message);
  }
}

module.exports = { sendErrorAlert };
