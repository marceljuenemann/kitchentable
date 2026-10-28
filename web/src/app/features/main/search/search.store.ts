import { Injectable, computed, inject, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ageFrom } from '../../../core/age';
import { Profile } from '../../../core/profile.model';
import { GENDER_OPTIONS, LOOKING_FOR_OPTIONS } from '../../onboarding/onboarding-options';
import { MOCK_MEMBERS, mockPhotoUrls } from './mock-members';

/** A member as search shows them. */
export interface Member extends Profile {
  /** When they became a member (passed the age check). Search shows the newest first. */
  age_verified_at: string;
}

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
export function matches(member: Member, filters: SearchFilters, now = new Date()): boolean {
  const overlaps = (values: string[], standard: string[], picked: string[]) =>
    picked.length === 0 ||
    values.some((value) => picked.includes(standard.includes(value) ? value : SELF_DESCRIBED));
  const unspecified = member.gender.length === 0 && filters.gender.includes(NOT_SPECIFIED);
  if (!unspecified && !overlaps(member.gender, GENDER_OPTIONS, filters.gender)) return false;
  const lookingForIds = LOOKING_FOR_OPTIONS.map((option) => option.id);
  if (!overlaps(member.looking_for, lookingForIds, filters.lookingFor)) return false;
  const age = ageFrom(`${member.birth_month ?? ''}`, `${member.birth_year ?? ''}`, now);
  if (age === null) return filters.showUnspecifiedAge;
  if (age < filters.minAge) return false;
  if (filters.maxAge < AGE_MAX && age > filters.maxAge) return false;
  return true;
}

/**
 * The members search shows, shared by the grid and the profile route, with the viewer's
 * filters and hidden people, newest members first.
 *
 * MOCK: the members are made up (mock-members.ts), and filtering, sorting and hiding happen
 * here, in memory. The real one asks the database, which filters and sorts in the query and
 * keeps hidden people per member (see prototype/browse/README.md).
 */
@Injectable()
export class SearchStore {
  private readonly snackBar = inject(MatSnackBar);

  readonly members = signal<Member[]>(MOCK_MEMBERS);
  /** Photo URLs by member id, in display order. */
  readonly photoUrls = signal(
    new Map(MOCK_MEMBERS.map((member) => [member.id, mockPhotoUrls(member)])),
  );
  readonly filters = signal<SearchFilters>(NO_FILTERS);
  /**
   * Whether only people of the genders in the Gender filter may see the viewer in their search.
   * MOCK: only kept here; the real one is saved on the profile and applied to others' searches.
   */
  readonly onlyShowMeToGenders = signal(false);
  readonly hiddenIds = signal<ReadonlySet<string>>(new Set());
  /** The member showing over the grid, if any. */
  readonly openId = signal<string | null>(null);

  readonly results = computed(() => {
    const filters = this.filters();
    const hidden = this.hiddenIds();
    return this.members()
      .filter((member) => !hidden.has(member.id) && matches(member, filters))
      .sort((a, b) => b.age_verified_at.localeCompare(a.age_verified_at));
  });

  member(id: string | null): Member | null {
    return this.members().find((member) => member.id === id) ?? null;
  }

  updateFilters(change: Partial<SearchFilters>) {
    this.filters.update((filters) => ({ ...filters, ...change }));
  }

  /** Takes someone off the grid for good, with a snackbar to undo it. */
  hide(member: Member) {
    this.setHidden(member.id, true);
    this.snackBar
      .open(`${member.name} won't show up again`, 'Undo', {
        duration: 4000,
        panelClass: 'kt-snackbar',
      })
      .onAction()
      .subscribe(() => this.setHidden(member.id, false));
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
