import { Routes } from '@angular/router';
import { adminGuard, authGuard, signedOutGuard } from './core/auth/auth.guard';
import { CallbackComponent } from './features/auth-callback/callback.component';
import { LandingComponent } from './features/landing/landing.component';

// Chunks: everything signed-out visitors need is in the initial bundle, everything for
// signed-in users is one lazy chunk (the shell and all its screens, and the admin tool; see
// signed-in-chunk.ts), and the policy documents load only when someone opens one. Fewer, bigger
// chunks mean fewer round trips one after another.
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canActivate: [signedOutGuard],
    component: LandingComponent,
  },
  {
    path: 'auth/callback',
    component: CallbackComponent,
  },
  // One route for everything a signed-in user sees: the shell picks the screen from the
  // profile status, so nobody can navigate into the wrong flow.
  {
    path: 'app',
    canActivate: [authGuard],
    loadComponent: () => import('./features/signed-in-chunk').then((m) => m.ShellComponent),
  },
  // For admin accounts (profile status `admin`) only.
  {
    path: 'admin',
    canMatch: [adminGuard],
    loadChildren: () => import('./features/signed-in-chunk').then((m) => m.ADMIN_ROUTES),
  },
  // Legal documents, public whether signed in or not.
  {
    path: 'about/terms',
    data: { policy: 'terms' },
    loadComponent: () => import('./shared/policy/policy-chunk').then((m) => m.PolicyPageComponent),
  },
  {
    path: 'about/privacy',
    data: { policy: 'privacy' },
    loadComponent: () => import('./shared/policy/policy-chunk').then((m) => m.PolicyPageComponent),
  },
  { path: '**', redirectTo: '' },
];
