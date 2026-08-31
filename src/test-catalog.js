const { getServiceName } = require('./catalog');

// Falls back to the known sandbox service_variation_id from CONTEXT.md if no id is passed.
// Usage: node src/test-catalog.js [service_variation_id]
const serviceVariationId = process.argv[2] || 'OEOGTN4ESB4225CJQKGZ7S2X';

(async () => {
  console.log('=== Square Catalog API test ===');
  console.log(`Using service_variation_id: ${serviceVariationId}`);

  try {
    const serviceName = await getServiceName(serviceVariationId);

    console.log('=== Service summary ===');
    console.log(`service name: ${serviceName}`);

    console.log('=== Test complete: Catalog module is working ===');
  } catch (err) {
    console.error('[test-catalog] Failed:', err.message);
    process.exit(1);
  }
})();
