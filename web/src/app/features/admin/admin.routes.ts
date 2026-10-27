import { Routes } from '@angular/router';
import { VettingComponent } from './vetting/vetting.component';

/**
 * The admin tool, loaded as one chunk of its own, behind `adminGuard`. The database refuses the
 * admin calls to anyone else anyway.
 */
export const ADMIN_ROUTES: Routes = [{ path: 'vetting', component: VettingComponent }];
