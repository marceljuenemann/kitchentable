const DAY = 24 * 60 * 60 * 1000;

function format(date: Date, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-GB', options).format(date);
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Calendar days between the two, ignoring the time of day. Rounded for clock changes. */
function daysBetween(earlier: Date, later: Date): number {
  return Math.round((startOfDay(later) - startOfDay(earlier)) / DAY);
}

export function isSameDay(a: string, b: string): boolean {
  return daysBetween(new Date(a), new Date(b)) === 0;
}

/** "14:05". */
export function clockTime(iso: string): string {
  return format(new Date(iso), { hour: '2-digit', minute: '2-digit' });
}

/** "28 Oct". */
export function shortDate(iso: string): string {
  return format(new Date(iso), { day: 'numeric', month: 'short' });
}

/** For the list of conversations: "14:05", "Yesterday", "Mon" or "28 Oct". */
export function listTime(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const days = daysBetween(date, now);
  if (days === 0) return clockTime(iso);
  if (days === 1) return 'Yesterday';
  if (days < 7) return format(date, { weekday: 'short' });
  return shortDate(iso);
}

/** Between the messages of a conversation: "Today", "Yesterday" or "Mon 28 Oct". */
export function dayLabel(iso: string, now = new Date()): string {
  const days = daysBetween(new Date(iso), now);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return format(new Date(iso), { weekday: 'short', day: 'numeric', month: 'short' }).replace(
    ',',
    '',
  );
}
