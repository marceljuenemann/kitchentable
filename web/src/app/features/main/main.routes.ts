import { Routes } from '@angular/router';
import { PROFILE_ROUTE_DATA } from '../../shared/profile-view/profile-transition';
import { ConnectionsComponent } from './connections/connections.component';
import { ProfileTabComponent } from './profile-tab/profile-tab.component';
import { SearchProfileComponent } from './search/search-profile.component';
import { SearchComponent } from './search/search.component';
import { SearchStore } from './search/search.store';
import { UnderConstructionComponent } from './under-construction.component';

/**
 * The main app's tabs, children of `/app`. They show only when the shell shows the main app
 * (active members and admins): for anyone else, the shell shows their status screen whatever
 * the URL. Search is `/app` itself, so links to `/app` (sign-in, emails, Didit's return) land on
 * it without a redirect. Other people's profiles open over the grid as its child,
 * `/app/profiles/:id`, like `/admin/vetting/:id`. The search store lives with the route, so the
 * filters stay while you visit other tabs.
 */
export const MAIN_ROUTES: Routes = [
  {
    path: '',
    component: SearchComponent,
    providers: [SearchStore],
    children: [
      { path: 'profiles/:id', component: SearchProfileComponent, data: PROFILE_ROUTE_DATA },
    ],
  },
  { path: 'profile', component: ProfileTabComponent, data: { title: 'Your profile' } },
  { path: 'connections', component: ConnectionsComponent },
  { path: 'messages', component: UnderConstructionComponent, data: { title: 'Messages' } },
  { path: 'community', component: UnderConstructionComponent, data: { title: 'Community' } },
  { path: '**', redirectTo: '' },
];
