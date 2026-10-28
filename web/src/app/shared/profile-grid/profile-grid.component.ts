import { Component, ElementRef, inject, input, linkedSignal, output, signal } from '@angular/core';
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

/** How far left a tile must be dragged to hide it, and how far it can go. */
const HIDE_THRESHOLD_PX = 76;
const MAX_DRAG_PX = 160;
/** Movement up to this is still a tap. */
const TAP_SLOP_PX = 4;
/** How long a hidden tile takes to slide out before it's reported. */
const SLIDE_OUT_MS = 180;

/**
 * Profiles as a grid of square tiles, two per row (prototype/browse). Each tile links to the
 * profile's id (after `linkPrefix`), relative to the current route, where a child route shows
 * the profile. With `hideable`, a tile swiped left slides out and is reported through `hide`;
 * the parent takes it off the list.
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
  /** Path segments before the id in a tile's link, e.g. `['profiles']`. */
  readonly linkPrefix = input<string[]>([]);
  readonly hideable = input(false);
  readonly hide = output<ProfileTile>();

  /**
   * The one tile that morphs: the one tapped (to open), or the open profile's (to close, which
   * may be by the browser's back). Every other tile stays part of the page, or its photo would
   * float above the profile during the animation.
   */
  private readonly morphId = linkedSignal<string | null, string | null>({
    source: this.openId,
    computation: (openId, previous) => openId ?? previous?.value ?? null,
  });

  /** The tile being swiped, and how far (0 or less). */
  readonly drag = signal<{ id: string; dx: number } | null>(null);
  /** The tile sliding out after a swipe far enough. */
  readonly leaving = signal<string | null>(null);
  private pointer: { id: string; startX: number } | null = null;
  /** Set after a swipe, so the click that ends it doesn't open the profile. */
  private swallowClick = false;

  constructor() {
    // In the capture phase, to stop the click before it reaches the tile's RouterLink, which
    // navigates even when the click's default is prevented.
    inject<ElementRef<HTMLElement>>(ElementRef).nativeElement.addEventListener(
      'click',
      (event) => {
        if (!this.swallowClick) return;
        event.stopPropagation();
        event.preventDefault();
      },
      true,
    );
  }

  link(tile: ProfileTile): string[] {
    return [...this.linkPrefix(), tile.id];
  }

  /** While its profile shows, the tile gives up the name to the profile's photo. */
  transitionName(tile: ProfileTile): string {
    const morphs = tile.id === this.morphId() && tile.id !== this.openId();
    return morphs ? photoTransitionName(tile.id) : 'none';
  }

  /** Before the navigation, so the browser captures this tile as the morph's start. */
  opening(tile: ProfileTile) {
    this.morphId.set(tile.id);
  }

  /** How far the tile is swiped towards hiding, from 0 to 1. */
  progress(tile: ProfileTile): number {
    if (this.leaving() === tile.id) return 1;
    const drag = this.drag();
    return drag?.id === tile.id ? Math.min(1, -drag.dx / HIDE_THRESHOLD_PX) : 0;
  }

  /** The strip the tile uncovers, so "Hide profile" doesn't show through the fading tile. */
  revealWidth(tile: ProfileTile): string {
    if (this.leaving() === tile.id) return '100%';
    const drag = this.drag();
    return drag?.id === tile.id ? `${-drag.dx}px` : '0';
  }

  offset(tile: ProfileTile): string | null {
    if (this.leaving() === tile.id) return 'translateX(-110%)';
    const drag = this.drag();
    return drag?.id === tile.id ? `translateX(${drag.dx}px)` : null;
  }

  onPointerDown(event: PointerEvent, tile: ProfileTile) {
    if (!this.hideable() || !event.isPrimary || event.button !== 0 || this.leaving()) return;
    this.pointer = { id: tile.id, startX: event.clientX };
  }

  onPointerMove(event: PointerEvent, tile: ProfileTile) {
    if (this.pointer?.id !== tile.id) return;
    const dx = Math.max(-MAX_DRAG_PX, Math.min(0, event.clientX - this.pointer.startX));
    if (!this.drag()) {
      if (dx > -TAP_SLOP_PX) return;
      // Keeps the moves coming when the pointer leaves the tile.
      (event.currentTarget as Element).setPointerCapture(event.pointerId);
    }
    this.drag.set({ id: tile.id, dx });
  }

  onPointerUp(tile: ProfileTile) {
    const drag = this.drag();
    this.pointer = null;
    if (!drag) return;
    this.drag.set(null);
    // The click comes straight after pointerup, if at all (a touch that moved has none).
    this.swallowClick = true;
    setTimeout(() => (this.swallowClick = false));
    if (drag.dx > -HIDE_THRESHOLD_PX) return;
    this.leaving.set(tile.id);
    setTimeout(() => {
      this.leaving.set(null);
      this.hide.emit(tile);
    }, SLIDE_OUT_MS);
  }

  /** The browser took over, say to scroll: the tile springs back. */
  onPointerCancel() {
    this.pointer = null;
    this.drag.set(null);
  }
}
