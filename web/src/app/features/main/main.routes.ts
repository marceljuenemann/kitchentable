import { Routes } from '@angular/router';
import { PROFILE_ROUTE_DATA } from '../../shared/profile-view/profile-transition';
import { CommunityComponent } from './community/community.component';
import { ConnectionsComponent } from './connections/connections.component';
import { RequestProfileComponent } from './connections/request-profile.component';
import { ConversationProfileComponent } from './messages/conversation-profile.component';
import { ConversationComponent } from './messages/conversation.component';
import { MessagesComponent } from './messages/messages.component';
import { MyProfileStore } from './profile-tab/my-profile.store';
import { ProfilePreviewComponent } from './profile-tab/profile-preview.component';
import { ProfileTabComponent } from './profile-tab/profile-tab.component';
import { SearchProfileComponent } from './search/search-profile.component';
import { SearchComponent } from './search/search.component';
import { SearchStore } from './search/search.store';

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
  {
    path: 'profile',
    component: ProfileTabComponent,
    providers: [MyProfileStore],
    children: [{ path: 'preview', component: ProfilePreviewComponent, data: PROFILE_ROUTE_DATA }],
  },
  {
    path: 'connections',
    component: ConnectionsComponent,
    children: [{ path: ':id', component: RequestProfileComponent, data: PROFILE_ROUTE_DATA }],
  },
  {
    path: 'messages',
    component: MessagesComponent,
    children: [
      { path: 'profiles/:id', component: ConversationProfileComponent, data: PROFILE_ROUTE_DATA },
      // Where a profile opened by its URL goes back to, or it would count as a conversation's id.
      { path: 'profiles', pathMatch: 'full', redirectTo: '' },
      {
        path: ':id',
        component: ConversationComponent,
        children: [
          { path: 'profile', component: ConversationProfileComponent, data: PROFILE_ROUTE_DATA },
        ],
      },
    ],
  },
  { path: 'community', component: CommunityComponent },
  { path: '**', redirectTo: '' },
];
