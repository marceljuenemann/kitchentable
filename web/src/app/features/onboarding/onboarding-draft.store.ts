import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { UserStorage } from '../../core/user-storage';
import { MAX_PHOTOS } from './onboarding-options';
import { ProcessedPhoto } from './photos/photo-processor';

export const ONBOARDING_STEPS = 4;

/** A processed photo that has not been uploaded yet. */
export interface PendingPhoto extends ProcessedPhoto {
  id: string;
  /** Object URL of the thumbnail, for display. */
  thumbUrl: string;
}

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
  /** Step 2. */
  tagline: string;
  aboutText: string;
  /** Ids from LOOKING_FOR_OPTIONS, or the user's own text. */
  lookingFor: string[];
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
  tagline: '',
  aboutText: '',
  lookingFor: [],
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

  /**
   * Photos the user has added, in display order (first = main). Kept in memory only for now: they
   * are not uploaded or persisted yet (see docs/photos.md), so a reload loses them.
   */
  private readonly photoList = signal<PendingPhoto[]>([]);
  readonly photos = this.photoList.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.flush();
      this.photoList().forEach((photo) => URL.revokeObjectURL(photo.thumbUrl));
    });
  }

  addPhoto(photo: ProcessedPhoto) {
    const pending = {
      ...photo,
      id: crypto.randomUUID(),
      thumbUrl: URL.createObjectURL(photo.thumb),
    };
    this.photoList.update((photos) => [...photos, pending].slice(0, MAX_PHOTOS));
  }

  removePhoto(id: string) {
    const photo = this.photoList().find((candidate) => candidate.id === id);
    if (photo) URL.revokeObjectURL(photo.thumbUrl);
    this.photoList.update((photos) => photos.filter((candidate) => candidate.id !== id));
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
