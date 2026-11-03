import { Component, inject } from '@angular/core';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { openPolicySheet } from '../policy/open-policy-sheet';
import type { PolicyId } from '../policy/policy.component';

/**
 * The main app's links to the Terms of Use, the Privacy Policy (opened in a sheet, so the tab
 * stays put) and the contact address, since it has no footer. On the profile and Community tabs.
 */
@Component({
  selector: 'app-legal-links',
  standalone: true,
  template: `
    <ul>
      <li><a href="/about/terms" (click)="openPolicy($event, 'terms')">Terms of Use</a></li>
      <li><a href="/about/privacy" (click)="openPolicy($event, 'privacy')">Privacy Policy</a></li>
      <li><a href="mailto:hello@kitchentable.dating">Contact us</a></li>
    </ul>
  `,
  styles: `
    :host {
      display: block;
      margin-top: 24px;
    }

    ul {
      margin: 0;
      padding: 0;
      list-style: none;
    }

    li + li {
      margin-top: 12px;
    }

    a {
      font-size: 15px;
      color: var(--mat-sys-primary);
    }
  `,
})
export class LegalLinksComponent {
  private readonly bottomSheet = inject(MatBottomSheet);

  openPolicy(event: Event, policy: PolicyId) {
    event.preventDefault();
    void openPolicySheet(this.bottomSheet, policy);
  }
}
