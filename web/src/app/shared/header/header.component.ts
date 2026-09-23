import { Component } from '@angular/core';
import { LogoComponent } from '../logo/logo.component';

/** Logo + wordmark, left-aligned; the same on every screen. */
@Component({
  selector: 'app-header',
  standalone: true,
  imports: [LogoComponent],
  template: `
    <app-logo [size]="60" />
    <span class="wordmark">Kitchen Table</span>
  `,
  styleUrl: './header.component.scss',
})
export class HeaderComponent {}
