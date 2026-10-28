import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter, withInMemoryScrolling, withViewTransitions } from '@angular/router';

import { routes } from './app.routes';
import { onViewTransitionCreated } from './shared/profile-view/profile-transition';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    // New pages start at the top (the footer links are at the bottom of long pages), and Back
    // returns to where you were.
    provideRouter(
      routes,
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled' }),
      // Only for opening and closing a profile (the photo morph); see profile-transition.ts.
      withViewTransitions({ skipInitialTransition: true, onViewTransitionCreated }),
    ),
  ],
};
