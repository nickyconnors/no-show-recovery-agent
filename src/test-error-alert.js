const { sendErrorAlert } = require('./errorAlert');

// Simulates a pipeline failure to confirm a real alert email gets sent.
const fakeError = new Error('Simulated failure — Square API request failed with status 500');

(async () => {
  console.log('=== Error alert test ===');

  await sendErrorAlert(fakeError, 'test run (npm run test:error-alert)');

  console.log('=== Test complete: check your inbox for the failure alert email ===');
})();
