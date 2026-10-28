import { afterNextRender, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';

interface Tab {
  label: string;
  path: string;
  /** A 24×24 stroke path, or null for the logo. */
  icon: string | null;
}

/**
 * The main app for active members (and admins): the current tab (see main.routes.ts) above
 * the bottom nav, as designed in prototype/browse/.
 */
@Component({
  selector: 'app-main',
  standalone: true,
  imports: [RouterLink, RouterOutlet],
  templateUrl: './main.component.html',
  styleUrl: './main.component.scss',
})
export class MainComponent {
  readonly tabs: Tab[] = [
    {
      label: 'Your profile',
      path: '/app/profile',
      icon: 'M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM5 20c.8-3.4 3.6-5 7-5s6.2 1.6 7 5',
    },
    {
      label: 'Search',
      path: '/app',
      icon: 'M11 17.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM16 16l4.5 4.5',
    },
    {
      label: 'Connections',
      path: '/app/connections',
      icon:
        'M12 20C6.4 15.4 3 12.4 3 8.6 3 5.5 5.4 3 8.4 3c1.9 0 3 1 3.6 2.3C12.6 4 13.7 3 15.6 3 ' +
        '18.6 3 21 5.5 21 8.6c0 3.8-3.4 6.8-9 11.4z',
    },
    {
      label: 'Messages',
      path: '/app/messages',
      icon: 'M20 12a7 7 0 0 1-7 7H8l-4 3v-4.5A7 7 0 0 1 8 5h5a7 7 0 0 1 7 7z',
    },
    { label: 'Community', path: '/app/community', icon: null },
  ];

  private readonly router = inject(Router);
  /** The URL's path, without query parameters, matrix parameters or fragment. */
  private readonly path = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.currentPath()),
    ),
    { initialValue: this.currentPath() },
  );
  /**
   * The tab whose path the URL is in. Search is `/app` itself, the start of every tab's path, so
   * it's the current one when no other is: that includes a profile opened over its grid
   * (`/app/profiles/:id`), so the pill stays put rather than leaving and sliding back.
   */
  readonly currentTab = computed(() => {
    const path = this.path();
    const other = this.tabs.find(
      (tab) => tab.path !== '/app' && (path === tab.path || path.startsWith(`${tab.path}/`)),
    );
    return other ?? this.tabs.find((tab) => tab.path === '/app');
  });

  /**
   * Whether the pill slides when the tab changes. Off for the first render, so that opening a
   * tab directly doesn't slide it in from the first one.
   */
  readonly animated = signal(false);

  constructor() {
    afterNextRender(() => setTimeout(() => this.animated.set(true)));
  }

  private currentPath(): string {
    return this.router.url.split(/[?#;]/)[0];
  }
}
