import { Injectable, inject, signal } from '@angular/core';
import type { Session } from '@supabase/supabase-js';
import { asyncScheduler, distinctUntilChanged, Observable, observeOn, shareReplay } from 'rxjs';
import { SupabaseService } from '../supabase.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase = inject(SupabaseService);

  readonly session = signal<Session | null>(null);
  readonly ready = signal(false);

  /**
   * The signed-in user's id (null when signed out), following sign-in, sign-out and session
   * changes. Token refreshes don't re-emit. supabase-js emits the current session on subscribe.
   */
  readonly userId$: Observable<string | null> = new Observable<string | null>((subscriber) => {
    const { data } = this.supabase.client.auth.onAuthStateChange((_event, session) => {
      subscriber.next(session?.user.id ?? null);
    });
    return () => data.subscription.unsubscribe();
  }).pipe(
    // supabase-js holds an internal lock while running this callback, so awaiting another
    // supabase call synchronously from it (e.g. an rpc) would deadlock. Hop off the callback.
    observeOn(asyncScheduler),
    distinctUntilChanged(),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  constructor() {
    this.supabase.client.auth.getSession().then(({ data }) => {
      this.session.set(data.session);
      this.ready.set(true);
    });

    this.supabase.client.auth.onAuthStateChange((_event, session) => {
      this.session.set(session);
    });
  }

  async requestMagicLink(email: string, inviteCode?: string) {
    const { error } = await this.supabase.client.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        ...(inviteCode ? { data: { invite_code: inviteCode } } : {}),
      },
    });
    if (error) throw error;
  }

  /** Only ends the session: sign users out with `injectSignOut()`, which clears their storage too. */
  async signOut() {
    await this.supabase.client.auth.signOut();
  }
}
