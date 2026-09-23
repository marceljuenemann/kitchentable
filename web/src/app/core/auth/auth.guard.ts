import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseService } from '../supabase.service';

/** Signed-in users only; everyone else goes to the landing page. */
export const authGuard: CanActivateFn = async () => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  const { data } = await supabase.client.auth.getSession();
  return data.session ? true : router.parseUrl('/');
};

/** Public pages (landing): signed-in users are sent on to the app instead. */
export const signedOutGuard: CanActivateFn = async () => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  const { data } = await supabase.client.auth.getSession();
  return data.session ? router.parseUrl('/app') : true;
};
