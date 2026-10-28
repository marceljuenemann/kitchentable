import { Injectable, computed, inject, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ageFrom } from '../../../core/age';
import { Profile } from '../../../core/profile.model';
import { MOCK_MEMBERS, mockPhotoUrls } from './mock-members';

/** A member as search shows them. */
export interface Member extends Profile {
  /** When they became a member (passed the age check). Search shows the newest first. */
  age_verified_at: string;
}

/** The age slider's ends. The top one means "and older". */
export const AGE_MIN = 18;
export const AGE_MAX = 70;

/**
 * Within a field, someone matches if any of their values is picked; across fields, they must
 * match all. An empty field is "any". Values people wrote themselves never match a filter.
 */
export interface SearchFilters {
  /** `LOOKING_FOR_OPTIONS` ids. */
  lookingFor: string[];
  /** `GENDER_OPTIONS` values. */
  gender: string[];
  minAge: number;
  maxAge: number;
}

export const NO_FILTERS: SearchFilters = {
  lookingFor: [],
  gender: [],
  minAge: AGE_MIN,
  maxAge: AGE_MAX,
};

export function ageFiltered(filters: SearchFilters): boolean {
  return filters.minAge > AGE_MIN || filters.maxAge < AGE_MAX;
}

/** Whether a member matches the filters. With Age filtered, people without a birthday don't. */
export function matches(member: Member, filters: SearchFilters, now = new Date()): boolean {
  const overlaps = (values: string[], picked: string[]) =>
    picked.length === 0 || values.some((value) => picked.includes(value));
  if (!overlaps(member.gender, filters.gender)) return false;
  if (!overlaps(member.looking_for, filters.lookingFor)) return false;
  if (ageFiltered(filters)) {
    const age = ageFrom(`${member.birth_month ?? ''}`, `${member.birth_year ?? ''}`, now);
    if (age === null || age < filters.minAge) return false;
    if (filters.maxAge < AGE_MAX && age > filters.maxAge) return false;
  }
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

  clearFilters() {
    this.filters.set(NO_FILTERS);
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
