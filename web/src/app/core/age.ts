/** Age today, or null if month/year aren't both set. Day of birth is deliberately not collected. */
export function ageFrom(month: string, year: string, now = new Date()): number | null {
  if (!month || !year) return null;
  const birthMonth = Number(month);
  return now.getFullYear() - Number(year) - (now.getMonth() + 1 < birthMonth ? 1 : 0);
}
