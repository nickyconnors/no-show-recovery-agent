const { getCustomer } = require('./customers');

// Falls back to the known sandbox test customer from CONTEXT.md if no id is passed.
// Usage: node src/test-customers.js [customer_id]
const customerId = process.argv[2] || '3S86WTRVS368NS23N8JS29DDCM';

(async () => {
  console.log('=== Square Customers API test ===');
  console.log(`Using customer_id: ${customerId}`);

  try {
    const { name, phone } = await getCustomer(customerId);

    console.log('=== Customer summary ===');
    console.log(`name: ${name}`);
    console.log(`phone: ${phone}`);

    console.log('=== Test complete: Customers module is working ===');
  } catch (err) {
    console.error('[test-customers] Failed:', err.message);
    process.exit(1);
  }
})();
