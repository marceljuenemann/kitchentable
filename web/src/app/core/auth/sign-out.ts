import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { UserStorage } from '../user-storage';
import { AuthService } from './auth.service';

/**
 * Returns the function that signs the user out: it clears what the user keeps in the browser
 * (`UserStorage.onSignOut()`, for privacy on shared devices), then ends the session and goes to
 * the landing page. Every "Sign out" goes through this, rather than `AuthService.signOut()`
 * directly. Call it in an injection context, such as a field initializer.
 */
export function injectSignOut(): () => Promise<void> {
  const auth = inject(AuthService);
  const router = inject(Router);
  const userStorage = inject(UserStorage);

  return async () => {
    userStorage.onSignOut();
    await auth.signOut();
    await router.navigateByUrl('/');
  };
}
