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
    <p class="notice">
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

    .notice {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      margin: 20px 0 0;
      padding: 14px 16px;
      border: 1px solid color-mix(in oklch, var(--kt-gold) 35%, transparent);
      border-radius: 14px;
      background: var(--kt-gold-container);
      font-size: 15px;
      line-height: 1.5;
      color: var(--kt-ink);

      mat-icon {
        flex: none;
        color: var(--kt-gold);
      }
    }
  `,
})
export class UnderConstructionComponent {
  readonly title: string = inject(ActivatedRoute).snapshot.data['title'];
}
