import { Routes } from '@angular/router';
import { PROFILE_ROUTE_DATA } from '../../shared/profile-view/profile-transition';
import { VettingProfileComponent } from './vetting/vetting-profile.component';
import { VettingComponent } from './vetting/vetting.component';
import { VettingStore } from './vetting/vetting.store';

/**
 * The admin tool, behind `adminGuard`, in the signed-in chunk (signed-in-chunk.ts). The
 * database refuses the admin calls to anyone else anyway.
 */
export const ADMIN_ROUTES: Routes = [
  {
    path: 'vetting',
    component: VettingComponent,
    providers: [VettingStore],
    children: [{ path: ':id', component: VettingProfileComponent, data: PROFILE_ROUTE_DATA }],
  },
];
