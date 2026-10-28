import { Routes } from '@angular/router';
import { ProfileTabComponent } from './profile-tab/profile-tab.component';
import { UnderConstructionComponent } from './under-construction.component';

/**
 * The main app's tabs, children of `/app`. They show only when the shell shows the main app
 * (active members and admins): for anyone else, the shell shows their status screen whatever
 * the URL. Search is `/app` itself, so links to `/app` (sign-in, emails, Didit's return) land on
 * it without a redirect. Other people's profiles are to open over the grid as its child,
 * `/app/people/:id`, like `/admin/vetting/:id`.
 */
export const MAIN_ROUTES: Routes = [
  { path: '', component: UnderConstructionComponent, data: { title: 'Search' } },
  { path: 'profile', component: ProfileTabComponent, data: { title: 'Your profile' } },
  { path: 'connections', component: UnderConstructionComponent, data: { title: 'Connections' } },
  { path: 'messages', component: UnderConstructionComponent, data: { title: 'Messages' } },
  { path: 'community', component: UnderConstructionComponent, data: { title: 'Community' } },
  { path: '**', redirectTo: '' },
];
