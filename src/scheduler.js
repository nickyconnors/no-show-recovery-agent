require('dotenv').config();

const cron = require('node-cron');
const { runPipeline } = require('./pipeline');
const { sendErrorAlert } = require('./errorAlert');

// Cron expression: minute hour day month weekday. Default: every 15 minutes.
// Override with CRON_SCHEDULE in .env if a different cadence is needed.
const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '*/15 * * * *';

if (!cron.validate(CRON_SCHEDULE)) {
  throw new Error(`Invalid CRON_SCHEDULE: "${CRON_SCHEDULE}"`);
}

let runCount = 0;

async function tick() {
  runCount += 1;
  console.log(
    `\n########## [scheduler] Run #${runCount} starting at ${new Date().toISOString()} ##########`
  );

  try {
    await runPipeline();
  } catch (err) {
    await sendErrorAlert(err, `scheduled run #${runCount}`);
  }

  console.log(`########## [scheduler] Run #${runCount} finished ##########\n`);
}

console.log('=== No-Show Recovery Agent — scheduled runner ===');
console.log(`[scheduler] Cron schedule: "${CRON_SCHEDULE}" (default: every 15 minutes)`);
console.log('[scheduler] Running once immediately, then on the schedule above...');

tick();

cron.schedule(CRON_SCHEDULE, tick);

console.log('[scheduler] Scheduler is running. Press Ctrl+C to stop.');
