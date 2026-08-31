require('dotenv').config();

const { formatLocalDateTime } = require('./formatLocalDateTime');

const ANTHROPIC_VERSION = '2023-06-01';
const MODEL = 'claude-sonnet-4-5';
const MAX_TOKENS = 150;

// Must match the sample message text submitted in the Twilio Campaign Registry
// filing byte-for-byte — appended in code (not left to the prompt) since LLM
// output isn't guaranteed verbatim across generations. See CONTEXT.md.
const OPT_OUT_TEXT = 'Reply STOP to opt out, HELP for help.';

// Full SMS must stay under 300 chars including the opt-out suffix (~38 chars
// with its separator), so Claude gets a tighter budget with room to spare.
const GENERATED_MESSAGE_CHAR_LIMIT = 240;

const { ANTHROPIC_API_KEY } = process.env;

function assertConfigured() {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('Missing required .env value: ANTHROPIC_API_KEY');
  }
}

/**
 * Generates a friendly no-show recovery SMS via Claude, using the prompt
 * proven out in the Make.com prototype (see CONTEXT.md).
 * Uses start_at (not end_at) — "we missed you at your 11:15am appointment"
 * reads more naturally than referencing when the appointment would have ended.
 * @param {{ customer_name: string, service_name: string, start_at: string }} params
 */
async function generateNoShowMessage({ customer_name, service_name, start_at }) {
  assertConfigured();

  // LLMs are unreliable at converting a raw UTC timestamp to local time and
  // relative day (see CONTEXT.md) — always pre-format before it reaches the prompt.
  const formattedStartAt = formatLocalDateTime(start_at);

  const prompt =
    `Write a short, friendly SMS (under ${GENERATED_MESSAGE_CHAR_LIMIT} characters) to a barbershop ` +
    `customer who missed their appointment. Their name is ${customer_name}, they booked a ` +
    `${service_name}, and it was scheduled for ${formattedStartAt}. Invite them to rebook ` +
    `this week. Keep it casual and warm, not corporate. Only output the SMS ` +
    `text, nothing else.`;

  console.log('[claudeMessage] Generating no-show message...');
  console.log(
    `[claudeMessage] customer_name=${customer_name}, service_name=${service_name}, ` +
      `start_at (raw)=${start_at}, start_at (formatted)=${formattedStartAt}`
  );
  console.log(`[claudeMessage] Prompt: ${prompt}`);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  console.log(`[claudeMessage] Response status: ${response.status} ${response.statusText}`);

  const data = await response.json();

  if (!response.ok) {
    console.error(`[claudeMessage] API error — type: ${data.error?.type}, message: ${data.error?.message}`);
    throw new Error(`Anthropic API request failed with status ${response.status}`);
  }

  const messageText = (data.content || [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim();

  console.log(`[claudeMessage] Generated message (${messageText.length} chars): "${messageText}"`);

  const finalMessage = `${messageText} ${OPT_OUT_TEXT}`;

  console.log(`[claudeMessage] Appended opt-out text: "${OPT_OUT_TEXT}"`);
  console.log(`[claudeMessage] Final message (${finalMessage.length} chars): "${finalMessage}"`);

  if (finalMessage.length > 300) {
    console.warn(
      `[claudeMessage] WARNING: final message is ${finalMessage.length} chars, over the 300-char SMS limit.`
    );
  }

  return finalMessage;
}

module.exports = { generateNoShowMessage, MODEL, MAX_TOKENS, OPT_OUT_TEXT, GENERATED_MESSAGE_CHAR_LIMIT };
