import { inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, Router } from '@angular/router';
import { SupabaseService } from '../supabase.service';
import { safeNext } from './next-url';

/** Signed-in users only; everyone else signs in first, then comes back to the page. */
export const authGuard: CanActivateFn = async (_route, state) => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  const { data } = await supabase.client.auth.getSession();
  return data.session ? true : signInFirst(router, state.url);
};

/**
 * Admins only (profile status `admin`): signed-out visitors sign in first, everyone else goes to
 * the app. `canMatch` rather than `canActivate`, so nothing is loaded for anyone it turns away.
 * The database checks again on every admin call; this only decides what people see.
 */
export const adminGuard: CanMatchFn = async () => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  const { data } = await supabase.client.auth.getSession();
  if (!data.session) {
    // A `canMatch` guard only gets the segments, so the URL comes from the navigation.
    return signInFirst(router, router.currentNavigation()?.extractedUrl.toString() ?? '/admin');
  }
  const { data: isAdmin } = await supabase.client.rpc('is_admin');
  return isAdmin === true ? true : router.parseUrl('/app');
};

/**
 * Pages for signed-out visitors (the landing page, sign-in): signed-in users are sent on to the
 * app, or to the page they asked to sign in for.
 */
export const signedOutGuard: CanActivateFn = async (route) => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  const { data } = await supabase.client.auth.getSession();
  return data.session ? router.parseUrl(safeNext(route.queryParamMap.get('next'))) : true;
};

function signInFirst(router: Router, url: string) {
  return router.createUrlTree(['/sign-in'], { queryParams: { next: url } });
}
