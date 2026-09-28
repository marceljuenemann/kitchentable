import { LOOKING_FOR_OPTIONS, lookingForLabel, lookingForValueFor } from './onboarding-options';

describe('lookingForLabel', () => {
  it('shows the label of a standard option', () => {
    expect(lookingForLabel('solo-poly')).toBe('Solo poly');
  });

  it('shows the user’s own text as it is', () => {
    expect(lookingForLabel('Running buddies')).toBe('Running buddies');
  });
});

describe('lookingForValueFor', () => {
  it('stores the id when the text is the label of a standard option, ignoring case and spacing', () => {
    expect(lookingForValueFor('Solo poly')).toBe('solo-poly');
    expect(lookingForValueFor('  solo POLY ')).toBe('solo-poly');
  });

  it('stores the id when the text already is one', () => {
    expect(lookingForValueFor('nesting-partner')).toBe('nesting-partner');
  });

  it('stores anything else trimmed', () => {
    expect(lookingForValueFor('  Running buddies ')).toBe('Running buddies');
  });

  it('round-trips every standard option', () => {
    for (const option of LOOKING_FOR_OPTIONS) {
      expect(lookingForValueFor(lookingForLabel(option.id))).toBe(option.id);
    }
  });
});
