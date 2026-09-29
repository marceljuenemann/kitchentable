import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { environment } from '../environments/environment';

// sessionStorage rather than a plain signal: the auth callback does a hard redirect, which
// would otherwise bring the banner straight back. A new tab or session shows it again.
const STAGING_DISMISSED_KEY = 'kt-staging-banner-dismissed';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, MatButtonModule, MatIconModule],
  template: `
    <router-outlet />
    @if (showStagingBanner()) {
      <div class="staging-banner" role="note">
        <span>Staging environment for testing only. Don't use real personal data.</span>
        <button mat-icon-button aria-label="Dismiss" (click)="dismissStagingBanner()">
          <mat-icon>close</mat-icon>
        </button>
      </div>
    }
  `,
  // Fixed over the page rather than in the flow, so the 100dvh layouts don't get a scrollbar.
  styles: `
    .staging-banner {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 4px 4px calc(4px + env(safe-area-inset-bottom)) 16px;
      background: var(--mat-sys-error);
      color: var(--mat-sys-on-error);
      font: var(--mat-sys-label-large);
    }
    .staging-banner button {
      color: inherit;
    }
  `,
})
export class App {
  readonly showStagingBanner = signal(environment.staging && !readDismissed());

  dismissStagingBanner() {
    this.showStagingBanner.set(false);
    try {
      sessionStorage.setItem(STAGING_DISMISSED_KEY, '1');
    } catch {
      // Storage blocked: it stays dismissed until the next reload.
    }
  }
}

function readDismissed(): boolean {
  try {
    return sessionStorage.getItem(STAGING_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}
