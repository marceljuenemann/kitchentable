import { Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute } from '@angular/router';

/** Placeholder for a tab of the main app that isn't built yet. The title comes from the route. */
@Component({
  selector: 'app-under-construction',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <h1>{{ title }}</h1>
    <p class="kt-notice">
      <mat-icon aria-hidden="true">construction</mat-icon>
      <span>Still under construction. Thank you for being an early tester!</span>
    </p>
  `,
  styles: `
    :host {
      display: block;
    }

    h1 {
      margin: 38px 0 0;
      font-family: var(--kt-font-display);
      font-size: 24px;
      font-weight: 700;
      line-height: 1.2;
      color: var(--kt-violet);
    }

    .kt-notice {
      margin-top: 20px;
    }
  `,
})
export class UnderConstructionComponent {
  readonly title: string = inject(ActivatedRoute).snapshot.data['title'];
}
