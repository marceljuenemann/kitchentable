/**
 * Age today, or null if month/year aren't both set. Day of birth is deliberately not collected, so
 * the birthday counts only once the birth month is over: nobody is shown older than they are. Keep
 * in step with the age in `get_connected_profiles()` (SQL).
 */
export function ageFrom(month: string, year: string, now = new Date()): number | null {
  if (!month || !year) return null;
  const birthMonth = Number(month);
  return now.getFullYear() - Number(year) - (now.getMonth() + 1 <= birthMonth ? 1 : 0);
}
