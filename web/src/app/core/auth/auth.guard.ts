import { inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, Router } from '@angular/router';
import { SupabaseService } from '../supabase.service';

/** Signed-in users only; everyone else goes to the landing page. */
export const authGuard: CanActivateFn = async () => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  const { data } = await supabase.client.auth.getSession();
  return data.session ? true : router.parseUrl('/');
};

/**
 * Admins only (profile status `admin`): signed-out visitors go to the landing page, everyone else
 * to the app. `canMatch` rather than `canActivate`, so nothing is loaded for anyone it turns away.
 * The database checks again on every admin call; this only decides what people see.
 */
export const adminGuard: CanMatchFn = async () => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  const { data } = await supabase.client.auth.getSession();
  if (!data.session) return router.parseUrl('/');
  const { data: isAdmin } = await supabase.client.rpc('is_admin');
  return isAdmin === true ? true : router.parseUrl('/app');
};

/** Public pages (landing): signed-in users are sent on to the app instead. */
export const signedOutGuard: CanActivateFn = async () => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  const { data } = await supabase.client.auth.getSession();
  return data.session ? router.parseUrl('/app') : true;
};
