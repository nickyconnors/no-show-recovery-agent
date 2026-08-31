const { generateNoShowMessage } = require('./claudeMessage');

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

    console.log('=== Test complete: Claude message module is working ===');
  } catch (err) {
    console.error('[test-claude] Failed:', err.message);
    process.exit(1);
  }
})();
