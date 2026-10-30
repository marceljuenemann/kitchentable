import { Component, OnDestroy, signal } from '@angular/core';

/** A heart floating up from the panda after a hug. */
export interface FloatingHeart {
  id: number;
  /** Sideways drift by the end, in px. */
  dx: number;
  /** Tilt by the end, in degrees. */
  rotate: number;
  /** Seconds before it starts. */
  delay: number;
  /** One of the logo's arc colours, by index. */
  colour: number;
}

const HUG_MS = 900;
const HEARTS_PER_HUG = 5;

/**
 * A panda holding the logo's heart, for empty states. Tapping it hugs the heart (arms in, happy
 * eyes, a blush) and sends a few hearts in the logo's colours floating up. A "Tap me!" hint
 * with an arrow sits above it, diagonally, until the first hug.
 */
@Component({
  selector: 'app-hug-panda',
  standalone: true,
  templateUrl: './hug-panda.component.html',
  styleUrl: './hug-panda.component.scss',
})
export class HugPandaComponent implements OnDestroy {
  readonly hugging = signal(false);
  /** Hugged at least once, so the "Tap me!" hint can go. */
  readonly hugged = signal(false);
  readonly hearts = signal<FloatingHeart[]>([]);

  private nextId = 0;
  private hugTimer?: ReturnType<typeof setTimeout>;

  hug(): void {
    this.hugging.set(true);
    this.hugged.set(true);
    clearTimeout(this.hugTimer);
    this.hugTimer = setTimeout(() => this.hugging.set(false), HUG_MS);

    // Fanned out from left to right, with a little randomness so no two hugs look the same.
    const added = Array.from({ length: HEARTS_PER_HUG }, (_, i) => {
      const id = this.nextId++;
      return {
        id,
        dx: Math.round((i - (HEARTS_PER_HUG - 1) / 2) * 30 + (Math.random() - 0.5) * 16),
        rotate: Math.round((Math.random() - 0.5) * 50),
        delay: Math.round(Math.random() * 25) / 100,
        colour: id % 4,
      };
    });
    this.hearts.update((hearts) => [...hearts, ...added]);
  }

  /** Called when a heart's animation ends. */
  remove(id: number): void {
    this.hearts.update((hearts) => hearts.filter((heart) => heart.id !== id));
  }

  ngOnDestroy(): void {
    clearTimeout(this.hugTimer);
  }
}
