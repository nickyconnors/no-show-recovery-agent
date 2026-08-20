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
 * Fetches a customer from Square's Customers API and returns their name and phone number.
 * Bookings only carry a customer_id — this resolves it to something a message can use.
 * @param {string} customerId
 */
async function getCustomer(customerId) {
  assertConfigured();

  if (!customerId) {
    throw new Error('getCustomer requires a customerId');
  }

  const url = new URL(`/v2/customers/${customerId}`, SQUARE_API_BASE);

  console.log(`[customers] Fetching customer ${customerId}...`);
  console.log(`[customers] Full request URL: ${url.toString()}`);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${SQUARE_ACCESS_TOKEN}`,
      'Square-Version': SQUARE_VERSION,
      // Without this, Square returns 406 Not Acceptable for some HTTP clients' default Accept header.
      Accept: 'application/json',
    },
  });

  console.log(`[customers] Response status: ${response.status} ${response.statusText}`);

  const data = await response.json();

  if (!response.ok) {
    const errors = data.errors || [];
    for (const err of errors) {
      console.error(
        `[customers] API error — category: ${err.category}, code: ${err.code}, detail: ${err.detail}`
      );
    }
    throw new Error(`Square Customers API request failed with status ${response.status}`);
  }

  const customer = data.customer || {};

  const name = [customer.given_name, customer.family_name].filter(Boolean).join(' ') || null;
  const phone = customer.phone_number || null;

  if (!name) {
    console.log(`[customers] Customer ${customerId} has no given_name/family_name on file.`);
  }
  if (!phone) {
    console.log(`[customers] Customer ${customerId} has no phone_number on file.`);
  }

  console.log(`[customers] Resolved customer ${customerId}: name="${name}", phone="${phone}"`);

  return { name, phone };
}

module.exports = { getCustomer, SQUARE_VERSION };
