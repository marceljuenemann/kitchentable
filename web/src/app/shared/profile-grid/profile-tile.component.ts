import { Component, input } from '@angular/core';

/** What a tile shows. */
export interface ProfileTile {
  id: string;
  name: string;
  tagline: string;
  /** The main photo's thumbnail, or null for none (or not loaded yet). */
  photoUrl: string | null;
}

/**
 * How a profile looks in the grid: the square main photo (or the name's initial) with the name
 * and tagline over its bottom edge. Only the look: the grid adds the link and the gestures, and
 * the tagline sheet shows one as a preview.
 */
@Component({
  selector: 'app-profile-tile',
  standalone: true,
  template: `
    <div class="photo" [style.view-transition-name]="transitionName()">
      @if (tile().photoUrl) {
        <img [src]="tile().photoUrl" alt="" draggable="false" />
      } @else {
        <span class="initial" aria-hidden="true">{{ tile().name.charAt(0) }}</span>
      }
    </div>
    <div class="caption">
      <p class="name">{{ tile().name }}</p>
      @if (tile().tagline) {
        <p class="tagline">{{ tile().tagline }}</p>
      }
    </div>
  `,
  styles: `
    :host {
      position: relative;
      display: block;
    }

    // Rounded itself (not only clipped by the tile), so the morph's snapshot has round corners.
    .photo {
      aspect-ratio: 1 / 1;
      border-radius: 10px;
      overflow: hidden;
      background: var(--kt-violet-container);

      img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    }

    .initial {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      font-family: var(--kt-font-display);
      font-size: 56px;
      font-weight: 700;
      color: var(--kt-violet-soft);
    }

    .caption {
      position: absolute;
      inset: auto 0 0;
      padding: 34px 12px 11px;
      border-radius: 0 0 10px 10px;
      background: linear-gradient(
        to top,
        oklch(0.16 0.06 300 / 0.9) 0%,
        oklch(0.16 0.06 300 / 0.64) 46%,
        oklch(0.16 0.06 300 / 0) 100%
      );
    }

    .name {
      margin: 0;
      font-family: var(--kt-font-display);
      font-size: 17px;
      font-weight: 700;
      line-height: 1.15;
      color: white;
    }

    // At most 60 characters (onboarding), so two lines or fewer.
    .tagline {
      margin: 4px 0 0;
      font-size: 13.5px;
      line-height: 1.35;
      color: oklch(0.995 0.004 95 / 0.95);
    }
  `,
})
export class ProfileTileComponent {
  readonly tile = input.required<ProfileTile>();
  /** The photo's `view-transition-name`, for the morph into the profile. */
  readonly transitionName = input<string | null>(null);
}
