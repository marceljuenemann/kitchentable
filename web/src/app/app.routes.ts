import { Routes } from '@angular/router';
import { authGuard, signedOutGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canActivate: [signedOutGuard],
    loadComponent: () =>
      import('./features/landing/landing.component').then((m) => m.LandingComponent),
  },
  {
    path: 'auth/callback',
    loadComponent: () =>
      import('./features/auth-callback/callback.component').then((m) => m.CallbackComponent),
  },
  // One route for everything a signed-in user sees: the shell picks the screen from the
  // profile status, so nobody can navigate into the wrong flow.
  {
    path: 'app',
    canActivate: [authGuard],
    loadComponent: () => import('./features/shell/shell.component').then((m) => m.ShellComponent),
  },
  { path: '**', redirectTo: '' },
];
