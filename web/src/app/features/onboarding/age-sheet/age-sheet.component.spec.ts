import { ageFrom, birthYearOptions } from './age-sheet.component';

describe('ageFrom', () => {
  // 15 June 2026
  const now = new Date(2026, 5, 15);

  it('is null until both month and year are set', () => {
    expect(ageFrom('', '', now)).toBeNull();
    expect(ageFrom('6', '', now)).toBeNull();
    expect(ageFrom('', '1990', now)).toBeNull();
  });

  it('counts the birthday as passed from the start of the birth month', () => {
    expect(ageFrom('6', '1990', now)).toBe(36);
    expect(ageFrom('1', '1990', now)).toBe(36);
  });

  it('does not count a birthday later this year', () => {
    expect(ageFrom('7', '1990', now)).toBe(35);
    expect(ageFrom('12', '1990', now)).toBe(35);
  });
});

describe('birthYearOptions', () => {
  const now = new Date(2026, 5, 15);

  it('starts with the year of someone turning 19, so nobody under 18 can be chosen', () => {
    // Born in 2007 is 18 or 19 in 2026; 2008 could still be 17.
    expect(birthYearOptions(now)[0]).toBe(2007);
  });

  it('counts down 74 years, newest first', () => {
    const years = birthYearOptions(now);
    expect(years.length).toBe(74);
    expect(years[73]).toBe(1934);
    expect(years).toEqual([...years].sort((a, b) => b - a));
  });
});
