const { getBookings } = require('./square');
const { isNoShow } = require('./noShowFilter');
const { getCustomer } = require('./customers');
const { getServiceName } = require('./catalog');
const { generateNoShowMessage } = require('./claudeMessage');
const { sendNotification } = require('./notify');
const { loadNotifiedBookingIds, markBookingNotified } = require('./notifiedBookings');

async function runPipeline() {
  console.log('=== No-Show Recovery Agent — pipeline run ===');

  console.log('\n--- Stage 1: Fetch bookings ---');
  const bookings = await getBookings();
  console.log(`[pipeline] Fetched ${bookings.length} booking(s).`);
  for (const booking of bookings) {
    console.log(`[pipeline]   booking ${booking.id}: status=${booking.status}, end_at=${booking.end_at}`);
  }

  console.log('\n--- Stage 2: No-show filter ---');
  const noShows = bookings.filter((booking) => {
    const flagged = isNoShow(booking);
    console.log(`[pipeline] Booking ${booking.id}: no-show=${flagged}`);
    return flagged;
  });
  console.log(`[pipeline] ${noShows.length} of ${bookings.length} booking(s) flagged as no-shows.`);

  console.log('\n--- Stage 2.5: Skip already-notified bookings ---');
  let notifiedIds = loadNotifiedBookingIds();
  const newNoShows = [];
  const alreadyNotified = [];
  for (const booking of noShows) {
    if (notifiedIds.includes(booking.id)) {
      alreadyNotified.push(booking);
      console.log(`[pipeline] Booking ${booking.id} was already notified in a previous run — skipping.`);
    } else {
      newNoShows.push(booking);
      console.log(`[pipeline] Booking ${booking.id} is a new no-show — will notify.`);
    }
  }
  console.log(
    `[pipeline] ${newNoShows.length} new no-show(s) to notify, ${alreadyNotified.length} already notified previously.`
  );

  if (newNoShows.length === 0) {
    console.log('\n=== Pipeline run complete: no new no-shows to recover ===');
    return;
  }

  let sentCount = 0;

  for (const booking of newNoShows) {
    console.log(`\n--- Stage 3: Resolve customer + service for booking ${booking.id} ---`);

    const segments = booking.appointment_segments || [];
    const serviceVariationId = segments[0] && segments[0].service_variation_id;

    const [customer, serviceName] = await Promise.all([
      getCustomer(booking.customer_id),
      serviceVariationId ? getServiceName(serviceVariationId) : Promise.resolve(null),
    ]);

    console.log(
      `[pipeline] Booking ${booking.id} resolved: customer_name="${customer.name}", ` +
        `customer_email="${customer.email}", service_name="${serviceName}"`
    );

    if (!customer.email) {
      console.log(
        `[pipeline] Booking ${booking.id}: customer has no email on file — skipping notification (Gmail stand-in requires an email address).`
      );
      continue;
    }

    console.log(`\n--- Stage 4: Generate recovery message for booking ${booking.id} ---`);
    const message = await generateNoShowMessage({
      customer_name: customer.name,
      service_name: serviceName,
      start_at: booking.start_at,
    });
    console.log(`[pipeline] Generated message for booking ${booking.id}: "${message}"`);

    console.log(`\n--- Stage 5: Send notification for booking ${booking.id} ---`);
    await sendNotification({
      to: customer.email,
      subject: 'We missed you! Come back and rebook',
      body: message,
    });
    console.log(`[pipeline] Notification sent for booking ${booking.id} to ${customer.email}.`);

    notifiedIds = markBookingNotified(booking.id, notifiedIds);
    sentCount += 1;
  }

  console.log(
    `\n=== Pipeline run complete: ${sentCount} of ${newNoShows.length} new no-show(s) notified ===`
  );
}

module.exports = { runPipeline };
