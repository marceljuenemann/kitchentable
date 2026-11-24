// The profile fields' options are in core/profile-options.ts, since editing the profile uses
// them too.
//
// Onboarding no longer asks these (it used to, as a fourth step before submitting, removed on
// 2026-11-24). They stay for the admin vetting box, which shows older applications' answers under
// their questions, and in case they come back: `submit_onboarding` still takes the answers
// (`p_vetting_answers`), and the removed step is in git history (`vetting-step.component.ts`).

/** How long each answer had to be. */
export const VETTING_MIN_LENGTH = 80;

/** The private vetting questions. The id is the key the answers are stored under. */
export const VETTING_QUESTIONS = [
  { id: 'consent', prompt: 'In your own words, what is consent and why is it important?' },
  {
    id: 'guidelines',
    prompt:
      'What guidelines do you think everyone in the Kitchen Table community should adhere to?',
  },
];

/** Optional feedback on onboarding, stored with the vetting answers under this key. */
export const ONBOARDING_FEEDBACK_ID = 'onboarding_feedback';
