import { ageFrom } from './age';

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
