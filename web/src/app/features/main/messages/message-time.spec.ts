import { clockTime, dayLabel, isSameDay, listTime } from './message-time';

// A Monday.
const NOW = new Date(2026, 10, 2, 12, 0);

function at(month: number, day: number, hour = 9): string {
  return new Date(2026, month, day, hour, 5).toISOString();
}

describe('message times', () => {
  it('compares calendar days, not 24 hours', () => {
    expect(isSameDay(at(10, 1, 23), at(10, 2, 0))).toBeFalse();
    expect(isSameDay(at(10, 2, 0), at(10, 2, 23))).toBeTrue();
  });

  it('formats a clock time', () => {
    expect(clockTime(at(10, 2, 14))).toBe('14:05');
  });

  it('counts down the list’s labels with age', () => {
    expect(listTime(at(10, 2), NOW)).toBe('09:05');
    expect(listTime(at(10, 1), NOW)).toBe('Yesterday');
    expect(listTime(at(9, 29), NOW)).toBe('Thu');
    expect(listTime(at(9, 20), NOW)).toBe('20 Oct');
  });

  it('labels the days in a conversation', () => {
    expect(dayLabel(at(10, 2), NOW)).toBe('Today');
    expect(dayLabel(at(10, 1), NOW)).toBe('Yesterday');
    expect(dayLabel(at(9, 26), NOW)).toBe('Mon 26 Oct');
  });
});
