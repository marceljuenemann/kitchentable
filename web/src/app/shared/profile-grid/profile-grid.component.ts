import { Component, input, linkedSignal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { photoTransitionName } from '../profile-view/profile-transition';

/** What a tile shows. */
export interface ProfileTile {
  id: string;
  name: string;
  tagline: string;
  /** The main photo's thumbnail, or null for none (or not loaded yet). */
  photoUrl: string | null;
}

/**
 * Profiles as a grid of square tiles, two per row (prototype/browse). Each tile links to the
 * profile's id, relative to the current route, where a child route shows the profile.
 */
@Component({
  selector: 'app-profile-grid',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './profile-grid.component.html',
  styleUrl: './profile-grid.component.scss',
})
export class ProfileGridComponent {
  readonly tiles = input.required<ProfileTile[]>();
  /** The profile showing over the grid, if any. */
  readonly openId = input<string | null>(null);

  /**
   * The one tile that morphs: the one tapped (to open), or the open profile's (to close, which
   * may be by the browser's back). Every other tile stays part of the page, or its photo would
   * float above the profile during the animation.
   */
  private readonly morphId = linkedSignal<string | null, string | null>({
    source: this.openId,
    computation: (openId, previous) => openId ?? previous?.value ?? null,
  });

  /** While its profile shows, the tile gives up the name to the profile's photo. */
  transitionName(tile: ProfileTile): string {
    const morphs = tile.id === this.morphId() && tile.id !== this.openId();
    return morphs ? photoTransitionName(tile.id) : 'none';
  }

  /** Before the navigation, so the browser captures this tile as the morph's start. */
  opening(tile: ProfileTile) {
    this.morphId.set(tile.id);
  }
}
