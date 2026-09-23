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
import { Profile } from './profile.model';
import { SupabaseService } from './supabase.service';

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
