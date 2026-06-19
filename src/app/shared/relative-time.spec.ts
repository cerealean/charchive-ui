import { formatRelativeTime } from './relative-time';

describe('formatRelativeTime', () => {
  it('returns "recently" for an unparseable date', () => {
    expect(formatRelativeTime('not-a-date')).toBe('recently');
  });

  it('formats a date a few days in the past', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();

    expect(formatRelativeTime(threeDaysAgo)).toBe('3 days ago');
  });

  it('formats a date several months in the past', () => {
    const fourMonthsAgo = new Date(Date.now() - 4 * 2629800000).toISOString();

    expect(formatRelativeTime(fourMonthsAgo)).toBe('4 months ago');
  });
});
