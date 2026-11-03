import { Injectable, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { ageFrom } from '../../../core/age';
import { Member, MyProfile, NewProfile } from '../../../core/profile.model';
import { ProfileService } from '../../../core/profile.service';

/** The fields the profile tab edits. */
export type ProfileChanges = Partial<Omit<NewProfile, 'vetting_answers'>>;

/** The user's own profile as other members see it. */
export function toMember(profile: MyProfile): Member {
  const { id, name, pronouns, tagline, bio, location, gender, sexuality, looking_for, photos } =
    profile;
  return {
    id,
    name,
    pronouns,
    tagline,
    bio,
    location,
    gender,
    sexuality,
    looking_for,
    photos,
    age: ageFrom(`${profile.birth_month ?? ''}`, `${profile.birth_year ?? ''}`),
  };
}

/**
 * The profile the profile tab edits, provided on its route so the preview shares it. Saving isn't
 * built yet: changes are kept in memory only, and reloading the page undoes them.
 */
@Injectable()
export class MyProfileStore {
  private readonly loaded = toSignal(
    inject(ProfileService).state$.pipe(
      map((state) => (state.kind === 'loaded' ? state.profile : null)),
    ),
    { initialValue: null },
  );
  private readonly changes = signal<ProfileChanges>({});

  /** Null only until it has loaded (the main app shows once it has, so hardly ever). */
  readonly profile = computed<MyProfile | null>(() => {
    const profile = this.loaded();
    return profile && { ...profile, ...this.changes() };
  });
  readonly member = computed(() => {
    const profile = this.profile();
    return profile && toMember(profile);
  });

  async save(changes: ProfileChanges): Promise<void> {
    this.changes.update((saved) => ({ ...saved, ...changes }));
  }
}
