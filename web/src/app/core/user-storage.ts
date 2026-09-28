import { Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from './auth/auth.service';

const PREFIX = 'kt.user.';

/**
 * localStorage scoped to the signed-in user (keys are `kt.user.<userId>.<name>`), for things
 * like in-progress onboarding drafts. Nothing is read or written while signed out.
 *
 * Deliberately survives session expiry so users can come back later and pick up where they
 * left off; it is only cleared by an explicit sign-out, for privacy on shared devices. Whatever
 * signs the user out must call `onSignOut()` first.
 */
@Injectable({ providedIn: 'root' })
export class UserStorage {
  private readonly userId = signal<string | null>(null);

  constructor() {
    inject(AuthService)
      .userId$.pipe(takeUntilDestroyed())
      .subscribe((id) => this.userId.set(id));
  }

  get<T>(name: string): T | null {
    const key = this.key(name);
    if (!key) return null;
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? null : (JSON.parse(raw) as T);
    } catch {
      return null;
    }
  }

  set(name: string, value: unknown) {
    const key = this.key(name);
    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage unavailable or full: drafts just won't be kept.
    }
  }

  remove(name: string) {
    const key = this.key(name);
    if (!key) return;
    try {
      localStorage.removeItem(key);
    } catch {
      // Storage unavailable: nothing to remove.
    }
  }

  /**
   * Call when the user explicitly signs out: removes everything stored for them and forgets the
   * user right away, so nothing (e.g. a debounced save firing mid sign-out) is written again
   * until a user id arrives from a new sign-in.
   */
  onSignOut() {
    const id = this.userId();
    if (!id) return;
    this.userId.set(null);
    try {
      const prefix = `${PREFIX}${id}.`;
      Object.keys(localStorage)
        .filter((key) => key.startsWith(prefix))
        .forEach((key) => localStorage.removeItem(key));
    } catch {
      // Storage unavailable: nothing to clear.
    }
  }

  private key(name: string): string | null {
    const id = this.userId();
    return id ? `${PREFIX}${id}.${name}` : null;
  }
}
