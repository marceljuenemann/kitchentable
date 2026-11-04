import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { UserStorage } from '../user-storage';
import { AuthService } from './auth.service';

/** Signing out doesn't wait longer than this for the local database to go. */
const REMOVE_DB_TIMEOUT_MS = 3000;

/**
 * Returns the function that signs the user out: it clears what the user keeps in the browser
 * (`UserStorage.onSignOut()` and their local copy of connections and messages, for privacy on
 * shared devices), then ends the session and goes to the landing page. Every "Sign out" goes
 * through this, rather than `AuthService.signOut()` directly. Call it in an injection context,
 * such as a field initializer.
 */
export function injectSignOut(): () => Promise<void> {
  const auth = inject(AuthService);
  const router = inject(Router);
  const userStorage = inject(UserStorage);

  return async () => {
    const userId = auth.session()?.user.id;
    userStorage.onSignOut();
    if (userId) await removeLocalDatabase(userId);
    await auth.signOut();
    await router.navigateByUrl('/');
  };
}

/**
 * Deletes the user's local database, if they have one. Through the signed-in chunk, where RxDB
 * is: the footer (and so this) is on the landing page too, and importing `connections-db` here
 * directly would split RxDB off into a chunk of its own. A failure (or another tab holding on to it) doesn't stop the sign-out: the data stays
 * under that user's name, and syncing carries on from it if they sign in again.
 */
async function removeLocalDatabase(userId: string) {
  try {
    const { removeConnectionsDb } = await import('../../features/signed-in-chunk');
    await Promise.race([
      removeConnectionsDb(userId),
      new Promise((resolve) => setTimeout(resolve, REMOVE_DB_TIMEOUT_MS)),
    ]);
  } catch (error) {
    console.warn('Could not remove the local database', error);
  }
}
