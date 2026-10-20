import { Component, computed, inject, signal } from '@angular/core';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { ProfileService } from '../../core/profile.service';
import { FooterComponent } from '../../shared/footer/footer.component';
import { HeaderComponent } from '../../shared/header/header.component';
import { openPolicySheet } from '../../shared/policy/open-policy-sheet';
import type { PolicyId } from '../../shared/policy/policy.component';

/**
 * Shown once the email address is confirmed and before anything else: the Terms of Use, and
 * the explicit consent the Privacy Policy asks for (section 5), kept as separate checkboxes.
 */
@Component({
  selector: 'app-terms',
  standalone: true,
  imports: [FooterComponent, HeaderComponent, MatButtonModule, MatCheckboxModule],
  templateUrl: './terms.component.html',
  styleUrl: './terms.component.scss',
})
export class TermsComponent {
  private readonly profiles = inject(ProfileService);
  private readonly bottomSheet = inject(MatBottomSheet);

  readonly termsAgreed = signal(false);
  readonly consentGiven = signal(false);
  readonly submitting = signal(false);
  readonly failed = signal(false);

  readonly canContinue = computed(
    () => this.termsAgreed() && this.consentGiven() && !this.submitting(),
  );

  /** The links sit inside the checkbox labels, so they mustn't toggle the checkbox. */
  openPolicy(event: Event, policy: PolicyId) {
    event.preventDefault();
    event.stopPropagation();
    void openPolicySheet(this.bottomSheet, policy);
  }

  /** On success the shell moves on to onboarding, replacing this screen. */
  async continue() {
    if (!this.canContinue()) return;
    this.submitting.set(true);
    this.failed.set(false);
    try {
      await this.profiles.acceptTerms();
    } catch {
      this.failed.set(true);
      this.submitting.set(false);
    }
  }
}
