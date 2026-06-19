const defaultFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/**
 * Formats an ISO date string as a human-friendly relative time (for example
 * "3 days ago"). Invalid dates fall back to the string "recently".
 */
export function formatRelativeTime(
  isoDate: string,
  formatter: Intl.RelativeTimeFormat = defaultFormatter,
): string {
  const now = Date.now();
  const timestamp = new Date(isoDate).getTime();

  if (Number.isNaN(timestamp)) {
    return 'recently';
  }

  const elapsedMs = timestamp - now;
  const minutes = Math.round(elapsedMs / 60000);
  const hours = Math.round(elapsedMs / 3600000);
  const days = Math.round(elapsedMs / 86400000);
  const weeks = Math.round(elapsedMs / 604800000);
  const months = Math.round(elapsedMs / 2629800000);
  const years = Math.round(elapsedMs / 31557600000);

  if (Math.abs(minutes) < 60) {
    return formatter.format(minutes, 'minute');
  }

  if (Math.abs(hours) < 24) {
    return formatter.format(hours, 'hour');
  }

  if (Math.abs(days) < 7) {
    return formatter.format(days, 'day');
  }

  if (Math.abs(weeks) < 5) {
    return formatter.format(weeks, 'week');
  }

  if (Math.abs(months) < 12) {
    return formatter.format(months, 'month');
  }

  return formatter.format(years, 'year');
}
