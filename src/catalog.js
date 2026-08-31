require('dotenv').config();

const SQUARE_VERSION = '2026-01-22';

const { SQUARE_ACCESS_TOKEN, SQUARE_API_BASE } = process.env;

function assertConfigured() {
  const missing = [];
  if (!SQUARE_ACCESS_TOKEN) missing.push('SQUARE_ACCESS_TOKEN');
  if (!SQUARE_API_BASE) missing.push('SQUARE_API_BASE');
  if (missing.length) {
    throw new Error(`Missing required .env values: ${missing.join(', ')}`);
  }
}

/**
 * Fetches a service variation from Square's Catalog API and returns a readable service name.
 * Bookings only carry a service_variation_id — this resolves it to something a message can use.
 * @param {string} serviceVariationId
 */
async function getServiceName(serviceVariationId) {
  assertConfigured();

  if (!serviceVariationId) {
    throw new Error('getServiceName requires a serviceVariationId');
  }

  const url = new URL(`/v2/catalog/object/${serviceVariationId}`, SQUARE_API_BASE);
  // The variation object alone only has a generic name (e.g. "Regular") — the readable
  // service name (e.g. "Haircut") lives on the parent ITEM, returned via related_objects.
  url.searchParams.set('include_related_objects', 'true');

  console.log(`[catalog] Fetching catalog object ${serviceVariationId}...`);
  console.log(`[catalog] Full request URL: ${url.toString()}`);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${SQUARE_ACCESS_TOKEN}`,
      'Square-Version': SQUARE_VERSION,
      // Without this, Square returns 406 Not Acceptable for some HTTP clients' default Accept header.
      Accept: 'application/json',
    },
  });

  console.log(`[catalog] Response status: ${response.status} ${response.statusText}`);

  const data = await response.json();

  if (!response.ok) {
    const errors = data.errors || [];
    for (const err of errors) {
      console.error(
        `[catalog] API error — category: ${err.category}, code: ${err.code}, detail: ${err.detail}`
      );
    }
    throw new Error(`Square Catalog API request failed with status ${response.status}`);
  }

  const object = data.object || {};
  const variationData = object.item_variation_data || {};
  const variationName = variationData.name || null;
  const itemId = variationData.item_id || null;

  console.log(`[catalog] Variation name: "${variationName}", parent item_id: ${itemId}`);

  const relatedObjects = data.related_objects || [];
  const item = relatedObjects.find((obj) => obj.type === 'ITEM' && obj.id === itemId);
  const itemName = item && item.item_data ? item.item_data.name : null;

  if (!itemName) {
    console.log(
      `[catalog] No parent ITEM found in related_objects for item_id ${itemId} — falling back to variation name.`
    );
  }

  const serviceName = itemName || variationName || null;

  if (!serviceName) {
    console.log(`[catalog] Could not resolve a readable name for service_variation_id ${serviceVariationId}.`);
  }

  console.log(`[catalog] Resolved service_variation_id ${serviceVariationId}: name="${serviceName}"`);

  return serviceName;
}

module.exports = { getServiceName, SQUARE_VERSION };
