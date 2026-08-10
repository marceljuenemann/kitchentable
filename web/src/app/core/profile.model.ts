export type ApplicationStatus = 'draft' | 'pending' | 'approved' | 'rejected';

export interface Profile {
  id: string;
  application_status: ApplicationStatus;
  application_submitted_at: string | null;
  application_consent_answer: string | null;
  application_enm_answer: string | null;
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
}

export interface ProfilePhoto {
  id: string;
  profile_id: string;
  storage_path: string;
  position: number;
}
