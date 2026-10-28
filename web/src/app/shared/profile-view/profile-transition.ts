import { ActivatedRouteSnapshot, ViewTransitionInfo } from '@angular/router';

/**
 * Opening a profile from a grid morphs the tile's photo into the profile's big photo (and back
 * on closing) with the View Transitions API: both carry this `view-transition-name`, and the
 * browser animates between them (timing in styles.scss). Only that one tile has the name (see
 * ProfileGridComponent), and it drops it while the profile shows, since names must be unique.
 */
export function photoTransitionName(profileId: string): string {
  return `profile-photo-${profileId}`;
}

/** Route data marking a route that shows a profile over a grid. */
export const PROFILE_ROUTE_DATA = { profileOverlay: true };

/**
 * For `withViewTransitions()`: only opening and closing a profile animates. Every other
 * navigation skips the transition and changes instantly, as before.
 */
export function onViewTransitionCreated({ transition, from, to }: ViewTransitionInfo) {
  if (showsProfile(from) === showsProfile(to)) transition.skipTransition();
}

function showsProfile(route: ActivatedRouteSnapshot): boolean {
  return !!route.data['profileOverlay'] || route.children.some(showsProfile);
}
