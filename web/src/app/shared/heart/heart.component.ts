import { Component, input } from '@angular/core';

/** The heart from the logo, in its gold. The view box is centred on it. */
@Component({
  selector: 'app-heart',
  standalone: true,
  template: `
    <svg viewBox="-40 -48 80 80" [attr.width]="size()" [attr.height]="size()" aria-hidden="true">
      <path
        fill="#E3AF47"
        d="M0 26C-22 8-38-4-38-20c0-13 10-22 21-22 8 0 14 5 17 11 3-6 9-11 17-11 11 0 21 9 21 22C38-4 22 8 0 26Z"
      />
    </svg>
  `,
  styles: `
    :host {
      flex: none;
      display: flex;
    }
  `,
})
export class HeartComponent {
  readonly size = input(20);
}
