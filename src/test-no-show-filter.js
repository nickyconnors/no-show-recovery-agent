const { isNoShow } = require('./noShowFilter');

// Sample bookings covering every value in Square's real BookingStatus enum.
// Only NO_SHOW should flag — see CONTEXT.md for why.
const cases = [
  {
    name: 'marked no-show by staff (NO_SHOW)',
    booking: { id: 'booking-no-show', status: 'NO_SHOW' },
    expected: true,
  },
  {
    name: 'accepted, still awaiting staff action (ACCEPTED)',
    booking: { id: 'booking-accepted', status: 'ACCEPTED' },
    expected: false,
  },
  {
    name: 'unaccepted booking (PENDING)',
    booking: { id: 'booking-pending', status: 'PENDING' },
    expected: false,
  },
  {
    name: 'declined by seller (DECLINED)',
    booking: { id: 'booking-declined', status: 'DECLINED' },
    expected: false,
  },
  {
    name: 'cancelled by customer (CANCELLED_BY_CUSTOMER)',
    booking: { id: 'booking-cancelled-customer', status: 'CANCELLED_BY_CUSTOMER' },
    expected: false,
  },
  {
    name: 'cancelled by seller (CANCELLED_BY_SELLER)',
    booking: { id: 'booking-cancelled-seller', status: 'CANCELLED_BY_SELLER' },
    expected: false,
  },
];

console.log('=== No-show filter test ===');

let allPassed = true;

for (const { name, booking, expected } of cases) {
  console.log(`\n--- Case: ${name} ---`);
  const actual = isNoShow(booking);
  const passed = actual === expected;
  if (!passed) allPassed = false;
  console.log(`Expected: ${expected}, Actual: ${actual} — ${passed ? 'PASS' : 'FAIL'}`);
}

console.log('');
if (allPassed) {
  console.log('=== Test complete: No-show filter is working (all cases passed) ===');
} else {
  console.error('=== Test failed: one or more cases did not match expected result ===');
  process.exit(1);
}
