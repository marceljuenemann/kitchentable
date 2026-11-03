// The profile fields' options are in core/profile-options.ts, since editing the profile uses
// them too. These are only asked in onboarding.

export const VETTING_MIN_LENGTH = 80;

/** The private vetting questions (step 4). The id is the key the answers are stored under. */
export const VETTING_QUESTIONS = [
  { id: 'consent', prompt: 'In your own words, what is consent and why is it important?' },
  {
    id: 'guidelines',
    prompt:
      'What guidelines do you think everyone in the Kitchen Table community should adhere to?',
  },
];

/** Optional feedback on onboarding (step 4), stored with the vetting answers under this key. */
export const ONBOARDING_FEEDBACK_ID = 'onboarding_feedback';
