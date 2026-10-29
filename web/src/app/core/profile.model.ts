/** See docs/database.md for what each status means and who may change it. */
export type ProfileStatus =
  'vetting' | 'approved' | 'active' | 'disabled' | 'suspended' | 'deleted' | 'admin';

/**
 * What onboarding submits to create a profile (`submit_onboarding`; each field is the argument
 * `p_<field>`), and the part of a stored profile that the user provided. Snake_case like the
 * database, so it is the same shape in both directions.
 */
export interface NewProfile {
  name: string;
  pronouns: string;
  /** May be empty. */
  tagline: string;
  bio: string;
  location: string;
  gender: string[];
  sexuality: string[];
  /** Both or neither. */
  birth_year: number | null;
  birth_month: number | null;
  looking_for: string[];
  /** Ids of photos in display order (first = main); files are described in docs/photos.md. */
  photos: string[];
  /** Answers to the vetting questions, keyed by question id. */
  vetting_answers: Record<string, string>;
}

/** A stored profile, as other people see it (and the part of the user's own that they see too). */
export interface Profile extends Omit<NewProfile, 'vetting_answers'> {
  id: string;
  status: ProfileStatus;
}

/** Search filters as saved with `set_search_filters` (see docs/database.md). */
export interface SavedSearchFilters {
  looking_for: string[];
  gender: string[];
  min_age: number;
  max_age: number;
  show_unspecified_age: boolean;
}

/** The user's own profile, as returned by `get_my_profile()` (which leaves out the vetting answers). */
export interface MyProfile extends Profile {
  /** Null until search first saves them. */
  search_filters: SavedSearchFilters | null;
  /** "Only show me to these genders" (only ever true with a Gender filter). */
  hide_by_gender: boolean;
}
