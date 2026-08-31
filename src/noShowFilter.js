/**
 * A booking counts as a no-show if and only if status === 'NO_SHOW' — meaning a
 * staff member explicitly marked it that way in the Square dashboard once they
 * realized the customer didn't show. See CONTEXT.md for why this replaced the
 * earlier time-based inference (Square's Booking object has no
 * attended/completed status, so elapsed time alone can't distinguish a
 * serviced customer from a true no-show).
 * @param {{ id?: string, status: string }} booking
 */
function isNoShow(booking) {
  const { id, status } = booking;

  console.log(`[noShowFilter] Checking booking ${id || '(no id)'}: status=${status}`);

  const result = status === 'NO_SHOW';

  console.log(`[noShowFilter] Booking ${id || '(no id)'}: isNoShow=${result}`);

  return result;
}

module.exports = { isNoShow };
