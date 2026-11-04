import { Component, effect, inject, signal, untracked } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConnectionsStore } from '../../../core/connections/connections.store';
import { HeaderComponent } from '../../../shared/header/header.component';
import { photoTransitionName } from '../../../shared/profile-view/profile-transition';
import { HugPandaComponent } from './hug-panda.component';
import { RequestTileComponent } from './request-tile.component';

/**
 * The Connections tab: introductions other members sent you, as tiles leading to their profile,
 * which opens as a child route; that's why the page scrolls itself: the router scrolls the window
 * to the top on every navigation. Opening the tab counts as having seen them all. With none
 * left, the empty state.
 */
@Component({
  selector: 'app-connections',
  standalone: true,
  imports: [HeaderComponent, HugPandaComponent, RequestTileComponent, RouterOutlet],
  templateUrl: './connections.component.html',
  styleUrl: './connections.component.scss',
  host: { class: 'kt-scroller', '[class.covering]': 'profileOpen()' },
})
export class ConnectionsComponent {
  readonly store = inject(ConnectionsStore);

  /** Whether a profile shows over the tiles, which raises the page over the bottom nav. */
  readonly profileOpen = signal(false);
  /** The one photo that morphs, the last one tapped, as in ProfileGridComponent. */
  readonly morphId = signal<string | null>(null);

  constructor() {
    this.store.loadIfStale();
    // Also the ones that arrive while the tab is open.
    effect(() => {
      this.store.requests();
      untracked(() => this.store.markRequestsSeen());
    });
  }

  /** While the profile shows, the tile gives up the name to the profile's photo. */
  transitionName(id: string): string {
    const morphs = id === this.morphId() && !this.profileOpen();
    return morphs ? photoTransitionName(id) : 'none';
  }
}
