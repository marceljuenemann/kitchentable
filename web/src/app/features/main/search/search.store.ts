import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, concatMap, debounceTime, first } from 'rxjs';
import { PhotoStorageService } from '../../../core/photo-storage.service';
import { Member, MyProfile, SavedSearchFilters } from '../../../core/profile.model';
import { ProfileService } from '../../../core/profile.service';
import { SupabaseService } from '../../../core/supabase.service';
import { GENDER_OPTIONS, LOOKING_FOR_OPTIONS } from '../../onboarding/onboarding-options';

/** How long the filters must stay put before they're saved, so a slider drag is one save. */
const SAVE_DELAY_MS = 300;

/** Well within the hour that signed photo URLs last, so tiles shown again still load. */
const RELOAD_AFTER_MS = 30 * 60 * 1000;

/** The age slider's ends. The top one means "and older". */
export const AGE_MIN = 18;
export const AGE_MAX = 70;

/** The filter value for anything people wrote themselves, in either field. */
export const SELF_DESCRIBED = 'self-described';
/** The Gender filter value for people who left gender empty (it's optional). */
export const NOT_SPECIFIED = 'not-specified';

/** What each filter offers: the standard options, then Self-described. */
export const LOOKING_FOR_FILTERS = [
  ...LOOKING_FOR_OPTIONS.map(({ id, label }) => ({ value: id, label })),
  { value: SELF_DESCRIBED, label: 'Self-described' },
];
export const GENDER_FILTERS = [
  ...GENDER_OPTIONS.map((value) => ({ value, label: value })),
  { value: SELF_DESCRIBED, label: 'Self-described' },
  { value: NOT_SPECIFIED, label: 'Not specified' },
];

/**
 * Within a field, someone matches if any of their values is picked; across fields, they must
 * match all. An empty field is "any". Values people wrote themselves match Self-described, and
 * an empty gender matches Not specified.
 */
export interface SearchFilters {
  /** `LOOKING_FOR_FILTERS` values. */
  lookingFor: string[];
  /** `GENDER_FILTERS` values. */
  gender: string[];
  minAge: number;
  maxAge: number;
  /** Whether people who left their birthday out (it's optional) show, whatever the range. */
  showUnspecifiedAge: boolean;
}

export const NO_FILTERS: SearchFilters = {
  lookingFor: [],
  gender: [],
  minAge: AGE_MIN,
  maxAge: AGE_MAX,
  showUnspecifiedAge: true,
};

/** Whether the age range is narrower than any age. */
export function ageRanged(filters: SearchFilters): boolean {
  return filters.minAge > AGE_MIN || filters.maxAge < AGE_MAX;
}

/** Whether a member matches the filters. */
export function matches(member: Member, filters: SearchFilters): boolean {
  const overlaps = (values: string[], standard: string[], picked: string[]) =>
    picked.length === 0 ||
    values.some((value) => picked.includes(standard.includes(value) ? value : SELF_DESCRIBED));
  const unspecified = member.gender.length === 0 && filters.gender.includes(NOT_SPECIFIED);
  if (!unspecified && !overlaps(member.gender, GENDER_OPTIONS, filters.gender)) return false;
  const lookingForIds = LOOKING_FOR_OPTIONS.map((option) => option.id);
  if (!overlaps(member.looking_for, lookingForIds, filters.lookingFor)) return false;
  const { age } = member;
  if (age === null) return filters.showUnspecifiedAge;
  if (age < filters.minAge) return false;
  if (filters.maxAge < AGE_MAX && age > filters.maxAge) return false;
  return true;
}

/**
 * The members search shows, shared by the grid and the profile route. `search_profiles()` returns
 * everyone the viewer may see, newest members first, in one request; their filters apply here, so
 * changing them needs no further request (see docs/database.md).
 */
@Injectable()
export class SearchStore {
  private readonly snackBar = inject(MatSnackBar);
  private readonly supabase = inject(SupabaseService);
  private readonly photos = inject(PhotoStorageService);

  constructor() {
    // The shell shows search only once the profile has loaded, so this runs straight away.
    inject(ProfileService)
      .state$.pipe(first((state) => state.kind === 'loaded'))
      .subscribe((state) => state.kind === 'loaded' && this.applySaved(state.profile));

    // concatMap, not switchMap: an abandoned request still reaches the database, where it could
    // land after a newer one. Waiting saves pick up the latest filters when their turn comes.
    this.saveRequests
      .pipe(
        debounceTime(SAVE_DELAY_MS),
        concatMap(() => this.save()),
        takeUntilDestroyed(),
      )
      .subscribe();

    // In order, so that an undo can't land before the hiding it undoes.
    this.dismissals
      .pipe(
        concatMap((dismissal) => this.saveDismissal(dismissal)),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  /** Null while loading. */
  readonly members = signal<Member[] | null>(null);
  readonly loadFailed = signal(false);
  /** Main photo thumbnails by member id. */
  readonly thumbs = signal(new Map<string, string | null>());
  /** When the members were last asked for. */
  private loadedAt = 0;
  readonly filters = signal<SearchFilters>(NO_FILTERS);
  /** The "Only show me to these genders" switch, as the viewer last set it. */
  private readonly onlyShowMeToGenders = signal(false);
  /**
   * Whether only members of the genders in the Gender filter may see the viewer in their search.
   * Off while no gender is picked: there's nobody to limit it to.
   */
  readonly hideByGender = computed(
    () => this.onlyShowMeToGenders() && this.filters().gender.length > 0,
  );
  /** The `set_search_filters` arguments for the current filters and switch, as JSON. */
  private readonly saveArgs = computed(() => {
    const { lookingFor, gender, minAge, maxAge, showUnspecifiedAge } = this.filters();
    const filters: SavedSearchFilters = {
      looking_for: lookingFor,
      gender,
      min_age: minAge,
      max_age: maxAge,
      show_unspecified_age: showUnspecifiedAge,
    };
    return JSON.stringify({ p_filters: filters, p_hide_by_gender: this.hideByGender() });
  });
  /** What the database has, as `saveArgs`, so changes that end up the same send nothing. */
  private saved: string | null = null;
  private readonly saveRequests = new Subject<void>();
  private readonly dismissals = new Subject<{ member: Member; dismissed: boolean }>();
  /** Hidden since the members loaded; the database leaves them out from the next load on. */
  readonly hiddenIds = signal<ReadonlySet<string>>(new Set());
  /** The member showing over the grid, if any. */
  readonly openId = signal<string | null>(null);

  readonly results = computed(() => {
    const filters = this.filters();
    const hidden = this.hiddenIds();
    return (this.members() ?? []).filter(
      (member) => !hidden.has(member.id) && matches(member, filters),
    );
  });

  member(id: string | null): Member | null {
    return this.members()?.find((member) => member.id === id) ?? null;
  }

  /** Loads the members when search opens, unless that was only a little while ago. */
  loadIfStale() {
    if (Date.now() - this.loadedAt > RELOAD_AFTER_MS) void this.load();
  }

  /** Loads the members and their thumbnails, which show together. Keeps the old ones if it fails. */
  async load(): Promise<void> {
    this.loadedAt = Date.now();
    this.loadFailed.set(false);
    try {
      const { data, error } = await this.supabase.client.rpc('search_profiles');
      if (error) throw error;
      const members = data as Member[];
      const withPhoto = members.filter((member) => member.photos.length > 0);
      const urls = await this.photos.signedUrls(
        withPhoto.map(({ id, photos }) => ({ ownerId: id, photoId: photos[0] })),
        'thumb',
      );
      this.thumbs.set(new Map(withPhoto.map(({ id }, index) => [id, urls[index]])));
      this.members.set(members);
    } catch (error) {
      console.warn('Could not load search', error);
      this.loadedAt = 0;
      this.loadFailed.set(true);
    }
  }

  updateFilters(change: Partial<SearchFilters>) {
    this.filters.update((filters) => ({ ...filters, ...change }));
    this.saveRequests.next();
  }

  setOnlyShowMeToGenders(on: boolean) {
    this.onlyShowMeToGenders.set(on);
    this.saveRequests.next();
  }

  /** Starts from the filters and switch saved on the profile, if there are any. */
  private applySaved({ search_filters: saved, hide_by_gender }: MyProfile) {
    if (saved) {
      this.filters.set({
        lookingFor: saved.looking_for,
        gender: saved.gender,
        minAge: saved.min_age,
        maxAge: saved.max_age,
        showUnspecifiedAge: saved.show_unspecified_age,
      });
    }
    this.onlyShowMeToGenders.set(hide_by_gender);
    this.saved = this.saveArgs();
  }

  /**
   * Saves the filters and switch on the profile. Fire-and-forget: a failure shows a snackbar to
   * retry, and search carries on regardless.
   */
  private async save() {
    const args = this.saveArgs();
    if (args === this.saved) return;
    try {
      const { error } = await this.supabase.client.rpc('set_search_filters', JSON.parse(args));
      if (error) throw error;
      this.saved = args;
    } catch (error) {
      console.warn('Could not save the search filters', error);
      this.snackBar
        .open("Couldn't save your filters", 'Retry', { duration: 6000, panelClass: 'kt-snackbar' })
        .onAction()
        .subscribe(() => this.saveRequests.next());
    }
  }

  /** Takes someone off the grid for good, with a snackbar to undo it. */
  hide(member: Member) {
    this.setDismissed(member, true);
    this.snackBar
      .open(`${member.name} won't show up again`, 'Undo', {
        duration: 4000,
        panelClass: 'kt-snackbar',
      })
      .onAction()
      .subscribe(() => this.setDismissed(member, false));
  }

  /** Changes the grid straight away; a failure to save puts it back. */
  private setDismissed(member: Member, dismissed: boolean) {
    this.setHidden(member.id, dismissed);
    this.dismissals.next({ member, dismissed });
  }

  private async saveDismissal({ member, dismissed }: { member: Member; dismissed: boolean }) {
    try {
      const { error } = await this.supabase.client.rpc('set_dismissed', {
        p_user_id: member.id,
        p_dismissed: dismissed,
      });
      if (error) throw error;
    } catch (error) {
      console.warn('Could not save hiding a profile', error);
      this.setHidden(member.id, !dismissed);
      const message = dismissed
        ? `Couldn't hide ${member.name}`
        : `Couldn't bring back ${member.name}`;
      this.snackBar.open(message, undefined, { duration: 4000, panelClass: 'kt-snackbar' });
    }
  }

  private setHidden(id: string, hidden: boolean) {
    this.hiddenIds.update((ids) => {
      const next = new Set(ids);
      if (hidden) next.add(id);
      else next.delete(id);
      return next;
    });
  }
}
