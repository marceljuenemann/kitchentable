import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'apply' },
  {
    path: 'apply/start',
    loadComponent: () =>
      import('./features/apply/start/start.component').then((m) => m.StartComponent),
  },
  {
    path: 'auth/callback',
    loadComponent: () =>
      import('./features/apply/callback/callback.component').then((m) => m.CallbackComponent),
  },
  {
    path: 'apply',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/apply/stepper/stepper.component').then((m) => m.StepperComponent),
  },
  { path: '**', redirectTo: 'apply' },
];
