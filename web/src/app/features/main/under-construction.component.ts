import { Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute } from '@angular/router';

/** Placeholder for a tab of the main app that isn't built yet. The title comes from the route. */
@Component({
  selector: 'app-under-construction',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <h1 class="kt-tab-title">{{ title }}</h1>
    <p class="kt-notice">
      <mat-icon aria-hidden="true">construction</mat-icon>
      <span>Still under construction. Thank you for being an early tester!</span>
    </p>
  `,
  styles: `
    :host {
      display: block;
    }

    .kt-notice {
      margin-top: 20px;
    }
  `,
})
export class UnderConstructionComponent {
  readonly title: string = inject(ActivatedRoute).snapshot.data['title'];
}
