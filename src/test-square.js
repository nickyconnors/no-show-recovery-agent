const { getBookings } = require('./square');

(async () => {
  console.log('=== Square API test: fetching bookings ===');

  try {
    const bookings = await getBookings();

    console.log('=== Bookings summary ===');
    if (bookings.length === 0) {
      console.log(
        'No bookings found in this window. Check that the sandbox test account has bookings, ' +
          'or that Appointments is enabled (see CONTEXT.md).'
      );
    } else {
      bookings.forEach((b, i) => {
        console.log(
          `${i + 1}. id=${b.id} status=${b.status} start_at=${b.start_at} end_at=${b.end_at} customer_id=${b.customer_id}`
        );
      });
    }

    console.log('=== Test complete: Square module is working ===');
  } catch (err) {
    console.error('[test-square] Failed:', err.message);
    process.exit(1);
  }
})();
