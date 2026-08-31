const { generateNoShowMessage, OPT_OUT_TEXT } = require('./claudeMessage');

// Sample data — no live Square call needed, just exercising the Claude prompt.
const sample = {
  customer_name: 'Jon Wu',
  service_name: "Men's haircut",
  start_at: '2026-08-30T19:30:00Z',
};

(async () => {
  console.log('=== Claude message generation test ===');
  console.log(`Using sample data: ${JSON.stringify(sample)}`);

  try {
    const message = await generateNoShowMessage(sample);

    console.log('=== Generated message ===');
    console.log(message);
    console.log(`(${message.length} characters)`);

    console.log('\n=== Compliance checks ===');

    const endsWithOptOut = message.endsWith(OPT_OUT_TEXT);
    console.log(
      `Ends with exact opt-out text ("${OPT_OUT_TEXT}"): ${endsWithOptOut ? 'PASS' : 'FAIL'}`
    );

    const underLimit = message.length < 300;
    console.log(`Total length under 300 chars (actual: ${message.length}): ${underLimit ? 'PASS' : 'FAIL'}`);

    if (!endsWithOptOut || !underLimit) {
      throw new Error('One or more compliance checks failed — see above.');
    }

    console.log('\n=== Test complete: Claude message module is working ===');
  } catch (err) {
    console.error('[test-claude] Failed:', err.message);
    process.exit(1);
  }
})();
