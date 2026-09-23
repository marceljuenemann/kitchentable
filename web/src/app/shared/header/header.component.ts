import { Component, input } from '@angular/core';
import { LogoComponent } from '../logo/logo.component';

/** Logo + wordmark. `compact` is the small centred version used above the onboarding stepper. */
@Component({
  selector: 'app-header',
  standalone: true,
  imports: [LogoComponent],
  template: `
    <app-logo [size]="compact() ? 30 : 60" />
    <span class="wordmark">Kitchen Table</span>
  `,
  styleUrl: './header.component.scss',
  host: { '[class.compact]': 'compact()' },
})
export class HeaderComponent {
  readonly compact = input(false);
}
