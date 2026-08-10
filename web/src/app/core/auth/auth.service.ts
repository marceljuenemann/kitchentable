import { Injectable, signal } from '@angular/core';
import type { Session } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly session = signal<Session | null>(null);
  readonly ready = signal(false);

  constructor(private readonly supabase: SupabaseService) {
    this.supabase.client.auth.getSession().then(({ data }) => {
      this.session.set(data.session);
      this.ready.set(true);
    });

    this.supabase.client.auth.onAuthStateChange((_event, session) => {
      this.session.set(session);
    });
  }

  async requestMagicLink(email: string, inviteCode: string) {
    const { error } = await this.supabase.client.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: { invite_code: inviteCode },
      },
    });
    if (error) throw error;
  }

  async signOut() {
    await this.supabase.client.auth.signOut();
  }
}
