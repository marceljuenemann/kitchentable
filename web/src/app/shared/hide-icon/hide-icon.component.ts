import { Component } from '@angular/core';

/** A crossed-out eye, for "Hide profile". In the text's colour. */
@Component({
  selector: 'app-hide-icon',
  standalone: true,
  template: `
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
      aria-hidden="true"
    >
      <path d="M3 12c2.6-4.2 5.6-6.3 9-6.3s6.4 2.1 9 6.3c-2.6 4.2-5.6 6.3-9 6.3S5.6 16.2 3 12z" />
      <path d="M4 4l16 16" />
    </svg>
  `,
  styles: `
    :host {
      flex: none;
      display: flex;
    }
  `,
})
export class HideIconComponent {}
