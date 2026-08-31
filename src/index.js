const { getBookings } = require('./square');
const { isNoShow } = require('./noShowFilter');
const { getCustomer } = require('./customers');
const { getServiceName } = require('./catalog');
const { generateNoShowMessage } = require('./claudeMessage');
const { sendNotification } = require('./notify');

async function run() {
  console.log('=== No-Show Recovery Agent — pipeline run ===');

  console.log('\n--- Stage 1: Fetch bookings ---');
  const bookings = await getBookings();
  console.log(`[index] Fetched ${bookings.length} booking(s).`);
  for (const booking of bookings) {
    console.log(`[index]   booking ${booking.id}: status=${booking.status}, end_at=${booking.end_at}`);
  }

  console.log('\n--- Stage 2: No-show filter ---');
  const noShows = bookings.filter((booking) => {
    const flagged = isNoShow(booking);
    console.log(`[index] Booking ${booking.id}: no-show=${flagged}`);
    return flagged;
  });
  console.log(`[index] ${noShows.length} of ${bookings.length} booking(s) flagged as no-shows.`);

  if (noShows.length === 0) {
    console.log('\n=== Pipeline run complete: no no-shows to recover ===');
    return;
  }

  let sentCount = 0;

  for (const booking of noShows) {
    console.log(`\n--- Stage 3: Resolve customer + service for booking ${booking.id} ---`);

    const segments = booking.appointment_segments || [];
    const serviceVariationId = segments[0] && segments[0].service_variation_id;

    const [customer, serviceName] = await Promise.all([
      getCustomer(booking.customer_id),
      serviceVariationId ? getServiceName(serviceVariationId) : Promise.resolve(null),
    ]);

    console.log(
      `[index] Booking ${booking.id} resolved: customer_name="${customer.name}", ` +
        `customer_email="${customer.email}", service_name="${serviceName}"`
    );

    if (!customer.email) {
      console.log(
        `[index] Booking ${booking.id}: customer has no email on file — skipping notification (Gmail stand-in requires an email address).`
      );
      continue;
    }

    console.log(`\n--- Stage 4: Generate recovery message for booking ${booking.id} ---`);
    const message = await generateNoShowMessage({
      customer_name: customer.name,
      service_name: serviceName,
      start_at: booking.start_at,
    });
    console.log(`[index] Generated message for booking ${booking.id}: "${message}"`);

    console.log(`\n--- Stage 5: Send notification for booking ${booking.id} ---`);
    await sendNotification({
      to: customer.email,
      subject: 'We missed you! Come back and rebook',
      body: message,
    });
    console.log(`[index] Notification sent for booking ${booking.id} to ${customer.email}.`);

    sentCount += 1;
  }

  console.log(
    `\n=== Pipeline run complete: ${sentCount} of ${noShows.length} no-show(s) notified ===`
  );
}

run().catch((err) => {
  console.error('[index] Pipeline failed:', err.message);
  process.exit(1);
});
