import { Component, inject } from '@angular/core';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { AuthService } from '../../../core/auth/auth.service';
import { injectSignOut } from '../../../core/auth/sign-out';
import { openPolicySheet } from '../../../shared/policy/open-policy-sheet';
import type { PolicyId } from '../../../shared/policy/policy.component';
import { UnderConstructionComponent } from '../under-construction.component';

/**
 * The "Your profile" tab. Editing the profile isn't built yet, but the account part is: signing
 * out, and the legal documents (the main app has no footer).
 */
@Component({
  selector: 'app-profile-tab',
  standalone: true,
  imports: [MatButtonModule, MatCardModule, UnderConstructionComponent],
  templateUrl: './profile-tab.component.html',
  styleUrl: './profile-tab.component.scss',
})
export class ProfileTabComponent {
  private readonly bottomSheet = inject(MatBottomSheet);

  readonly session = inject(AuthService).session;
  readonly signOut = injectSignOut();

  openPolicy(event: Event, policy: PolicyId) {
    event.preventDefault();
    void openPolicySheet(this.bottomSheet, policy);
  }
}
