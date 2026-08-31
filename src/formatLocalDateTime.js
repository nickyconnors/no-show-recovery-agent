const DEFAULT_TIME_ZONE = 'America/Los_Angeles';

/**
 * Formats an ISO/UTC timestamp into a human-readable local-time string like
 * "today at 11:45am" or "Wednesday at 11:45am", in the business's timezone.
 * LLMs are unreliable at converting a raw UTC timestamp to local time and
 * relative day (see CONTEXT.md) — this must happen before the string ever
 * reaches a prompt.
 * @param {string} isoString
 * @param {{ timeZone?: string, now?: Date }} [options]
 */
function formatLocalDateTime(isoString, { timeZone = DEFAULT_TIME_ZONE, now = new Date() } = {}) {
  const date = new Date(isoString);

  const dateOnlyFmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const partsToUTCms = (parts) => {
    const get = (type) => Number(parts.find((p) => p.type === type).value);
    return Date.UTC(get('year'), get('month') - 1, get('day'));
  };

  const dayDiff = Math.round(
    (partsToUTCms(dateOnlyFmt.formatToParts(date)) - partsToUTCms(dateOnlyFmt.formatToParts(now))) /
      86400000
  );

  let dayLabel;
  if (dayDiff === 0) dayLabel = 'today';
  else if (dayDiff === 1) dayLabel = 'tomorrow';
  else if (dayDiff === -1) dayLabel = 'yesterday';
  else dayLabel = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long' }).format(date);

  const timeStr = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
    .format(date)
    .replace(/\s?([AP]M)/, (_match, ampm) => ampm.toLowerCase());

  return `${dayLabel} at ${timeStr}`;
}

module.exports = { formatLocalDateTime, DEFAULT_TIME_ZONE };
