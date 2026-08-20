require('dotenv').config();

// Bump this as Square's API evolves — see CONTEXT.md for why it's required.
const SQUARE_VERSION = '2026-01-22';

const { SQUARE_ACCESS_TOKEN, SQUARE_API_BASE, SQUARE_LOCATION_ID } = process.env;

function assertConfigured() {
  const missing = [];
  if (!SQUARE_ACCESS_TOKEN) missing.push('SQUARE_ACCESS_TOKEN');
  if (!SQUARE_API_BASE) missing.push('SQUARE_API_BASE');
  if (!SQUARE_LOCATION_ID) missing.push('SQUARE_LOCATION_ID');
  if (missing.length) {
    throw new Error(`Missing required .env values: ${missing.join(', ')}`);
  }
}

/**
 * Fetches bookings from Square's List Bookings endpoint.
 * @param {{ startAtMin?: string, startAtMax?: string }} opts RFC 3339 timestamps.
 *   Defaults startAtMin to 30 days ago (Square excludes past bookings unless asked).
 */
async function getBookings({ startAtMin, startAtMax } = {}) {
  assertConfigured();

  if (!startAtMin) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    startAtMin = thirtyDaysAgo.toISOString();
  }

  const url = new URL('/v2/bookings', SQUARE_API_BASE);
  url.searchParams.set('location_id', SQUARE_LOCATION_ID);
  url.searchParams.set('start_at_min', startAtMin);
  if (startAtMax) {
    url.searchParams.set('start_at_max', startAtMax);
  }

  console.log('[square] Fetching bookings from Square...');
  console.log(`[square] Base URL: ${SQUARE_API_BASE}`);
  console.log(`[square] Full request URL: ${url.toString()}`);
  console.log(
    `[square] start_at_min=${startAtMin}` +
      (startAtMax
        ? `, start_at_max=${startAtMax}`
        : ' (start_at_max omitted — Square defaults to 31 days after start_at_min)')
  );

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${SQUARE_ACCESS_TOKEN}`,
      'Square-Version': SQUARE_VERSION,
      // Without this, Square returns 406 Not Acceptable for some HTTP clients' default Accept header.
      Accept: 'application/json',
    },
  });

  console.log(`[square] Response status: ${response.status} ${response.statusText}`);

  const data = await response.json();

  if (!response.ok) {
    const errors = data.errors || [];
    for (const err of errors) {
      console.error(
        `[square] API error — category: ${err.category}, code: ${err.code}, detail: ${err.detail}`
      );
      if (err.detail && err.detail.includes('not onboarded to Appointments')) {
        console.error(
          '[square] Fix: open the Sandbox Seller Dashboard (Developer Dashboard → Sandbox test accounts → ' +
            'open dashboard) → Add more → Square Appointments → sign up for the Free plan → create at least ' +
            'one service, one staff member, and one test booking.'
        );
      }
    }
    throw new Error(`Square API request failed with status ${response.status}`);
  }

  const bookings = data.bookings || [];
  console.log(`[square] Received ${bookings.length} booking(s).`);

  if (data.cursor) {
    console.log(
      '[square] Note: response includes a pagination cursor — more results exist beyond this page ' +
        '(pagination not yet implemented, only the first page is returned).'
    );
  }

  const bookingsWithEndAt = bookings.map(addEndAt);

  return bookingsWithEndAt;
}

/**
 * Square's booking object has no end_at field — it must be calculated from
 * start_at + the duration of the first appointment segment.
 */
function addEndAt(booking) {
  const segments = booking.appointment_segments || [];

  if (segments.length === 0) {
    console.log(`[square] Booking ${booking.id} has no appointment_segments — cannot calculate end_at.`);
    return { ...booking, end_at: null };
  }

  const durationMinutes = segments[0].duration_minutes;
  const endAt = new Date(new Date(booking.start_at).getTime() + durationMinutes * 60000).toISOString();

  console.log(
    `[square] Booking ${booking.id}: start_at=${booking.start_at} + ${durationMinutes}min => end_at=${endAt}`
  );

  return { ...booking, end_at: endAt };
}

module.exports = { getBookings, SQUARE_VERSION };
