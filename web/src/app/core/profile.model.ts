/** See docs/database.md for what each status means and who may change it. */
export type ProfileStatus =
  'vetting' | 'approved' | 'active' | 'disabled' | 'suspended' | 'deleted';

export interface Profile {
  id: string;
  status: ProfileStatus;
  /** Answers to the vetting questions, keyed by question id. */
  vetting_answers: Record<string, unknown>;
  name: string | null;
  pronouns: string | null;
  tagline: string | null;
  bio: string | null;
  location: string | null;
  gender: string[];
  sexuality: string[];
  birth_year: number | null;
  birth_month: number | null;
  looking_for: string[];
  /** Photo ids in display order (first = main); files are described in docs/photos.md. */
  photos: string[];
}
