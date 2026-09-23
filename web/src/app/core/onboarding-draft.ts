/** localStorage key for the in-progress onboarding answers; cleared on sign-out. */
export const ONBOARDING_DRAFT_KEY = 'kt.onboardingDraft';

// TODO: Refactor this into something nicer.
export function clearOnboardingDraft() {
  try {
    localStorage.removeItem(ONBOARDING_DRAFT_KEY);
  } catch {
    // Storage unavailable (private mode etc.): nothing to clear.
  }
}
