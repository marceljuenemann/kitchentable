import { Injectable, inject } from '@angular/core';
import {
  BehaviorSubject,
  catchError,
  combineLatest,
  concat,
  from,
  Observable,
  of,
  shareReplay,
  switchMap,
} from 'rxjs';
import { AuthService } from './auth/auth.service';
import { MyProfile, NewProfile, ProfileStatus } from './profile.model';
import { SupabaseService } from './supabase.service';

/**
 * Postgres `unique_violation`: `submit_onboarding` raises it if a profile already exists, and
 * accepting terms that were already accepted does too.
 */
const ALREADY_DONE = '23505';

/**
 * The version of the Terms of Use and consent the terms screen asks for. Raise it only for
 * changes everyone needs to accept again. It is separate from the version printed on each
 * document.
 */
export const TERMS_VERSION = 1;

/**
 * - `loading`: fetching
 * - `signed-out`: no session
 * - `needs-terms`: signed in, but hasn't accepted the terms yet (so has no profile row either)
 * - `none`: accepted the terms but has no profile row yet (needs onboarding)
 * - `error`: the fetch failed
 */
export type ProfileState =
  | { kind: 'loading' | 'signed-out' | 'needs-terms' | 'none' | 'error' }
  | { kind: 'loaded'; profile: MyProfile };

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
    if (error && error.code !== ALREADY_DONE) throw error;
    this.refresh();
  }

  /**
   * Records that the user accepted the terms, then reloads so the shell moves on. If they
   * already had (say, in another tab), this reloads too.
   */
  async acceptTerms(): Promise<void> {
    // The database fills in the user and the time.
    const { error } = await this.supabase.client
      .from('terms_acceptances')
      .insert({ version: TERMS_VERSION });
    if (error && error.code !== ALREADY_DONE) throw error;
    this.refresh();
  }

  /**
   * Starts an age check (see "Age verification" in docs/database.md) and returns the URL of
   * Didit's page to send the user to.
   */
  async startAgeVerification(): Promise<string> {
    const { data, error } = await this.supabase.client.functions.invoke<{ url: string }>(
      'start-age-verification',
    );
    if (error) throw error;
    return data!.url;
  }

  /**
   * The profile's status, or null without a profile, for polling. Unlike `refresh()`, it doesn't
   * put `state$` back into `loading`, which would make the shell replace the current screen.
   */
  async fetchStatus(): Promise<ProfileStatus | null> {
    return (await this.getMyProfile())?.status ?? null;
  }

  private fetchState(): Observable<ProfileState> {
    return from(this.getState()).pipe(catchError(() => of<ProfileState>({ kind: 'error' })));
  }

  private async getState(): Promise<ProfileState> {
    const profile = await this.getMyProfile();
    if (profile) return { kind: 'loaded', profile };
    // Only checked without a profile: the database doesn't allow a profile without accepted
    // terms. Once there's a version 2, profiles need checking too.
    return (await this.hasAcceptedTerms()) ? { kind: 'none' } : { kind: 'needs-terms' };
  }

  private async hasAcceptedTerms(): Promise<boolean> {
    // RLS shows only the user's own rows.
    const { data, error } = await this.supabase.client
      .from('terms_acceptances')
      .select('version')
      .gte('version', TERMS_VERSION)
      .limit(1);
    if (error) throw error;
    return data.length > 0;
  }

  /** The profile, or null if the user hasn't completed onboarding yet. */
  private async getMyProfile(): Promise<MyProfile | null> {
    const { data, error } = await this.supabase.client.rpc('get_my_profile');
    if (error) throw error;
    return data as MyProfile | null;
  }
}
