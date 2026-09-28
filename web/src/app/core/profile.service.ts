import { Injectable, inject } from '@angular/core';
import {
  BehaviorSubject,
  catchError,
  combineLatest,
  concat,
  from,
  map,
  Observable,
  of,
  shareReplay,
  switchMap,
} from 'rxjs';
import { AuthService } from './auth/auth.service';
import { NewProfile, Profile } from './profile.model';
import { SupabaseService } from './supabase.service';

/** Postgres `unique_violation`, which `submit_onboarding` raises if a profile already exists. */
const ALREADY_APPLIED = '23505';

/**
 * - `loading`: fetching
 * - `signed-out`: no session
 * - `none`: signed in but no profile row yet (needs onboarding)
 * - `error`: the fetch failed
 */
export type ProfileState =
  { kind: 'loading' | 'signed-out' | 'none' | 'error' } | { kind: 'loaded'; profile: Profile };

/** All profile access goes through stored procedures, never the tables (see docs/database.md). */
@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);
  private readonly refreshTrigger = new BehaviorSubject<void>(undefined);

  /** The signed-in user's profile, refetched when the user changes or `refresh()` is called. */
  readonly state$: Observable<ProfileState> = combineLatest([
    this.auth.userId$,
    this.refreshTrigger,
  ]).pipe(
    switchMap(([userId]) =>
      userId
        ? concat(of<ProfileState>({ kind: 'loading' }), this.fetchState())
        : of<ProfileState>({ kind: 'signed-out' }),
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  refresh() {
    this.refreshTrigger.next();
  }

  /**
   * Creates the profile (in `vetting`) from a finished onboarding, then reloads the profile so
   * the shell moves on to the next screen. If the user already applied (say, in another tab)
   * this reloads too, since the shell then has the screen to show.
   */
  async submitOnboarding(profile: NewProfile): Promise<void> {
    // Every field is the function argument of the same name, with a `p_` prefix.
    const args = Object.fromEntries(
      Object.entries(profile).map(([field, value]) => [`p_${field}`, value]),
    );
    const { error } = await this.supabase.client.rpc('submit_onboarding', args);
    if (error && error.code !== ALREADY_APPLIED) throw error;
    this.refresh();
  }

  private fetchState(): Observable<ProfileState> {
    return from(this.getMyProfile()).pipe(
      map((profile): ProfileState => (profile ? { kind: 'loaded', profile } : { kind: 'none' })),
      catchError(() => of<ProfileState>({ kind: 'error' })),
    );
  }

  /** The profile, or null if the user hasn't completed onboarding yet. */
  private async getMyProfile(): Promise<Profile | null> {
    const { data, error } = await this.supabase.client.rpc('get_my_profile');
    if (error) throw error;
    return data as Profile | null;
  }
}
