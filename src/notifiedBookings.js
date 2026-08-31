const fs = require('fs');
const path = require('path');

const NOTIFIED_BOOKINGS_FILE = path.join(__dirname, '..', 'notified-bookings.json');

/**
 * Loads the list of booking ids that have already been notified, so repeated
 * scheduled runs don't re-send the same recovery message for a booking that
 * hasn't changed since the last run.
 * @returns {string[]}
 */
function loadNotifiedBookingIds() {
  if (!fs.existsSync(NOTIFIED_BOOKINGS_FILE)) {
    console.log(`[notifiedBookings] No existing ${NOTIFIED_BOOKINGS_FILE} — starting with an empty set.`);
    return [];
  }

  const raw = fs.readFileSync(NOTIFIED_BOOKINGS_FILE, 'utf8');
  const ids = raw.trim() ? JSON.parse(raw) : [];
  console.log(`[notifiedBookings] Loaded ${ids.length} previously-notified booking id(s) from ${NOTIFIED_BOOKINGS_FILE}.`);
  return ids;
}

/**
 * Records a booking id as notified, persisting it to disk immediately.
 * @param {string} bookingId
 * @param {string[]} notifiedIds current in-memory list (from loadNotifiedBookingIds)
 * @returns {string[]} the updated list, for the caller to keep using
 */
function markBookingNotified(bookingId, notifiedIds) {
  if (notifiedIds.includes(bookingId)) {
    return notifiedIds;
  }

  const updated = [...notifiedIds, bookingId];
  fs.writeFileSync(NOTIFIED_BOOKINGS_FILE, JSON.stringify(updated, null, 2));
  console.log(`[notifiedBookings] Marked booking ${bookingId} as notified (${updated.length} total tracked).`);
  return updated;
}

module.exports = { loadNotifiedBookingIds, markBookingNotified, NOTIFIED_BOOKINGS_FILE };
