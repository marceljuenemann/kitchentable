import { LOOKING_FOR_OPTIONS, lookingForLabel, lookingForValueFor } from './onboarding-options';

describe('lookingForLabel', () => {
  it('shows the label of a standard option', () => {
    expect(lookingForLabel('open-relationship')).toBe('Open relationship');
  });

  it('shows the user’s own text as it is', () => {
    expect(lookingForLabel('Running buddies')).toBe('Running buddies');
  });
});

describe('lookingForValueFor', () => {
  it('stores the id when the text is the label of a standard option, ignoring case and spacing', () => {
    expect(lookingForValueFor('Open relationship')).toBe('open-relationship');
    expect(lookingForValueFor('  open RELATIONSHIP ')).toBe('open-relationship');
  });

  it('stores the id when the text already is one', () => {
    expect(lookingForValueFor('play-partners')).toBe('play-partners');
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
