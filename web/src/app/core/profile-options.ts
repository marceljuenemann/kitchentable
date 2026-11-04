export const PRONOUN_OPTIONS = [
  'they/them',
  'she/her',
  'she/they',
  'he/him',
  'he/they',
  'any pronouns',
];

export const GENDER_OPTIONS = [
  'Non-binary',
  'Man',
  'Woman',
  'Genderqueer',
  'Genderfluid',
  'Agender',
  'Gender questioning',
];

export const SEXUALITY_OPTIONS = [
  'Queer',
  'Bisexual',
  'Pansexual',
  'Lesbian',
  'Gay',
  'Straight',
  'Heteroflexible',
  'Asexual',
  'Demisexual',
  'Aromantic',
  'Questioning',
];

export const MAX_PHOTOS = 6;
export const TAGLINE_MAX_LENGTH = 60;
export const ABOUT_MIN_LENGTH = 250;

/**
 * Standard "looking for" options. The id is what gets stored (so a label can be reworded without
 * a data migration); anything else in a draft/profile is the user's own text.
 */
export const LOOKING_FOR_OPTIONS = [
  { id: 'polyamory', label: 'Polyamory' },
  { id: 'open-relationship', label: 'Open relationship' },
  { id: 'relationship-anarchy', label: 'Relationship anarchy' },
  { id: 'friends', label: 'Friends' },
  { id: 'exploring', label: 'Exploring' },
  { id: 'casual', label: 'Casual' },
  { id: 'play-partners', label: 'Play partners' },
  { id: 'monogamy', label: 'Monogamy' },
];

/** The text to show for a stored "looking for" value. */
export function lookingForLabel(value: string): string {
  return LOOKING_FOR_OPTIONS.find((option) => option.id === value)?.label ?? value;
}

/** What to store for something the user typed: the standard id if it matches an option. */
export function lookingForValueFor(text: string): string {
  const lower = text.trim().toLowerCase();
  const match = LOOKING_FOR_OPTIONS.find(
    (option) => option.label.toLowerCase() === lower || option.id === lower,
  );
  return match?.id ?? text.trim();
}
