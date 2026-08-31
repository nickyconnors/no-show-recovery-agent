const { formatLocalDateTime } = require('./formatLocalDateTime');

// Fixed reference "now" so today/tomorrow/yesterday labels are deterministic.
const referenceNow = new Date('2026-08-30T21:00:00.000Z'); // 2:00pm PDT, Sunday Aug 30 2026

const cases = [
  {
    name: 'the original bug case (booking hrf23hhkf1awek: 18:45 UTC = 11:45am PDT, same day)',
    timestamp: '2026-08-30T18:45:00.000Z',
    expected: 'today at 11:45am',
  },
  {
    name: 'yesterday, same time of day',
    timestamp: '2026-08-29T18:45:00.000Z',
    expected: 'yesterday at 11:45am',
  },
  {
    name: 'tomorrow, same time of day',
    timestamp: '2026-08-31T18:45:00.000Z',
    expected: 'tomorrow at 11:45am',
  },
  {
    name: 'further out — falls back to weekday name',
    timestamp: '2026-09-02T18:45:00.000Z',
    expected: 'Wednesday at 11:45am',
  },
  {
    name: 'UTC calendar date rolls back a day once converted to Pacific time',
    timestamp: '2026-08-30T02:45:00.000Z', // UTC Aug 30, but 7:45pm Aug 29 in PDT
    expected: 'yesterday at 7:45pm',
  },
];

console.log('=== formatLocalDateTime test ===');
console.log(`Reference "now": ${referenceNow.toISOString()} (2:00pm PDT)`);

let allPassed = true;

for (const { name, timestamp, expected } of cases) {
  console.log(`\n--- Case: ${name} ---`);
  const actual = formatLocalDateTime(timestamp, { now: referenceNow });
  const passed = actual === expected;
  if (!passed) allPassed = false;
  console.log(`timestamp (UTC): ${timestamp}`);
  console.log(`Expected: "${expected}", Actual: "${actual}" — ${passed ? 'PASS' : 'FAIL'}`);
}

console.log('');
if (allPassed) {
  console.log('=== Test complete: formatLocalDateTime is working (all cases passed) ===');
} else {
  console.error('=== Test failed: one or more cases did not match expected result ===');
  process.exit(1);
}
