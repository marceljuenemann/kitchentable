import { Component, computed, input } from '@angular/core';
import { LogoComponent } from '../../../shared/logo/logo.component';

const TINTS = ['violet', 'sky', 'magenta', 'gold'];

/** The logo's outer ring is 252 wide in its 360 box, so this makes the ring fill the circle. */
const LOGO_SCALE = 360 / 252;

/**
 * A round picture of someone in a conversation: their main photo, or until it's available their
 * initial on one of the brand's tints. The team's is the logo.
 */
@Component({
  selector: 'app-avatar',
  standalone: true,
  imports: [LogoComponent],
  template: `
    @if (team()) {
      <app-logo [size]="size() * logoScale" />
    } @else if (photoUrl(); as url) {
      <img [src]="url" alt="" draggable="false" />
    } @else {
      {{ initial() }}
    }
  `,
  host: {
    'aria-hidden': 'true',
    '[class]': 'tint()',
    '[style.width.px]': 'size()',
    '[style.height.px]': 'size()',
    '[style.font-size.px]': 'size() * 0.42',
    '[style.view-transition-name]': 'transitionName()',
  },
  styles: `
    :host {
      flex: none;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      border-radius: 50%;
      font-family: var(--kt-font-display);
      font-weight: 700;
      line-height: 1;
    }

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    app-logo {
      flex: none;
      display: flex;
    }

    :host(.violet) {
      background: var(--kt-violet-container);
      color: var(--kt-violet);
    }

    :host(.sky) {
      background: var(--kt-sky-container);
      color: var(--kt-sky);
    }

    :host(.magenta) {
      background: var(--kt-magenta-container);
      color: var(--kt-magenta);
    }

    :host(.gold) {
      background: var(--kt-gold-container);
      color: var(--kt-gold);
    }

    :host(.team) {
      background: var(--kt-raised);
    }
  `,
})
export class AvatarComponent {
  readonly name = input.required<string>();
  readonly photoUrl = input<string | null>(null);
  readonly team = input(false);
  readonly size = input(52);
  /** For the morph into a profile's photo (see profile-transition.ts). */
  readonly transitionName = input<string | null>(null);

  readonly logoScale = LOGO_SCALE;

  readonly initial = computed(() => this.name().charAt(0).toUpperCase());
  readonly tint = computed(() =>
    this.team() ? 'team' : TINTS[this.name().charCodeAt(0) % TINTS.length],
  );
}
