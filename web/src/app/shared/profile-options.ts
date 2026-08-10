// Stable keys stored in the database; labels live here so they can be
// changed anytime without a migration (see PRODUCT.md / plan notes on why
// gender/sexuality aren't Postgres enums).

export interface ProfileOption {
  key: string;
  label: string;
}

export const GENDER_OPTIONS: ProfileOption[] = [
  { key: 'woman', label: 'Woman' },
  { key: 'man', label: 'Man' },
  { key: 'non_binary', label: 'Non-binary' },
  { key: 'other', label: 'Other' },
];

export const SEXUALITY_OPTIONS: ProfileOption[] = [
  { key: 'straight', label: 'Straight' },
  { key: 'gay', label: 'Gay' },
  { key: 'lesbian', label: 'Lesbian' },
  { key: 'bisexual', label: 'Bisexual' },
  { key: 'pansexual', label: 'Pansexual' },
  { key: 'queer', label: 'Queer' },
  { key: 'other', label: 'Other' },
];

export const LOOKING_FOR_OPTIONS: ProfileOption[] = [
  { key: 'enm_dating', label: 'ENM dating' },
  { key: 'friends', label: 'Friends' },
  { key: 'community', label: 'Community / events' },
];
