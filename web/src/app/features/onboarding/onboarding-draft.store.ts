import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { UserStorage } from '../../core/user-storage';

export const ONBOARDING_STEPS = 4;

/** The in-progress onboarding answers (see prototype/onboarding/README.md, "State model"). */
export interface OnboardingDraft {
  /** Current step, 1 to ONBOARDING_STEPS. */
  step: number;
  name: string;
  /** Exactly one entry once set. */
  pronouns: string[];
  gender: string[];
  sexuality: string[];
  /** "London" or the city the user typed in. */
  location: string;
  /** "1"-"12" */
  birthMonth: string;
  birthYear: string;
}

const EMPTY_DRAFT: OnboardingDraft = {
  step: 1,
  name: '',
  pronouns: [],
  gender: [],
  sexuality: [],
  location: 'London',
  birthMonth: '',
  birthYear: '',
};

const STORAGE_KEY = 'onboarding-draft';
const SAVE_DELAY_MS = 300;

/**
 * Holds the onboarding draft and persists it to UserStorage on every change (debounced), so
 * users can leave and resume later. Provided by OnboardingComponent, not root.
 */
@Injectable()
export class OnboardingDraftStore {
  private readonly storage = inject(UserStorage);
  private saveTimer: ReturnType<typeof setTimeout> | undefined;

  private readonly state = signal<OnboardingDraft>(this.restore());
  readonly draft = this.state.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.flush());
  }

  update(patch: Partial<OnboardingDraft>) {
    this.state.update((draft) => ({ ...draft, ...patch }));
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.flush(), SAVE_DELAY_MS);
  }

  /** Writes any pending change immediately (also called on page hide and destroy). */
  flush() {
    if (this.saveTimer === undefined) return;
    clearTimeout(this.saveTimer);
    this.saveTimer = undefined;
    this.storage.set(STORAGE_KEY, this.state());
  }

  private restore(): OnboardingDraft {
    const stored = this.storage.get<Partial<OnboardingDraft>>(STORAGE_KEY);
    const draft = { ...EMPTY_DRAFT, ...stored };
    draft.step = Math.min(Math.max(Math.trunc(Number(draft.step)) || 1, 1), ONBOARDING_STEPS);
    return draft;
  }
}
