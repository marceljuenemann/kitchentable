// TODO: Come up with actual options. Just AI generated so far

export const PRONOUN_OPTIONS = [
  'they/them',
  'she/her',
  'she/they',
  'he/him',
  'he/they',
  'any pronouns',
];

export const GENDER_OPTIONS = [
  'Woman',
  'Man',
  'Non-binary',
  'Agender',
  'Genderfluid',
  'Genderqueer',
  'Trans woman',
  'Trans man',
  'Transmasculine',
  'Transfeminine',
  'Intersex',
  'Questioning',
];

export const SEXUALITY_OPTIONS = [
  'Queer',
  'Bisexual',
  'Pansexual',
  'Lesbian',
  'Gay',
  'Straight',
  'Asexual',
  'Demisexual',
  'Aromantic',
  'Omnisexual',
  'Questioning',
];

export const TAGLINE_MAX_LENGTH = 60;
export const ABOUT_MIN_LENGTH = 250;

/**
 * Standard "looking for" options. The id is what gets stored (so a label can be reworded without
 * a data migration); anything else in a draft/profile is the user's own text.
 */
export const LOOKING_FOR_OPTIONS = [
  { id: 'solo-poly', label: 'Solo poly' },
  { id: 'relationship-anarchist', label: 'Relationship anarchist' },
  { id: 'nesting-partner', label: 'Nesting partner' },
  { id: 'open-couple', label: 'Open couple' },
  { id: 'kitchen-table-poly', label: 'Kitchen table poly' },
  { id: 'slow-dating', label: 'Slow dating' },
  { id: 'new-friends', label: 'New friends' },
  { id: 'dont-label-it', label: "Don't label it" },
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
