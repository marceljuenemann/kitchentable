import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { ProfileService, ProfileState } from '../../core/profile.service';
import { FooterComponent } from '../../shared/footer/footer.component';
import { HeaderComponent } from '../../shared/header/header.component';
import { AgeVerificationComponent } from '../age-verification/age-verification.component';
import { MainComponent } from '../main/main.component';
import { OnboardingComponent } from '../onboarding/onboarding.component';
import { SubmittedComponent } from '../onboarding/submitted/submitted.component';
import { TermsComponent } from '../terms/terms.component';

/**
 * Everything a signed-in user sees lives behind this one component: it shows the screen that
 * matches their profile status (see docs/database.md), rather than routes users could wander
 * into out of order. Each screen includes the header/footer it needs.
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    MatButtonModule,
    FooterComponent,
    HeaderComponent,
    AgeVerificationComponent,
    MainComponent,
    OnboardingComponent,
    SubmittedComponent,
    TermsComponent,
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  private readonly profiles = inject(ProfileService);

  private readonly state = toSignal(this.profiles.state$, {
    initialValue: { kind: 'loading' } as ProfileState,
  });

  readonly view = computed(() => {
    const state = this.state();
    switch (state.kind) {
      case 'loaded': {
        // Applicants check their age right after submitting. Those approved before they did
        // (`approved`) check it before going live.
        const { status, age_verified_at } = state.profile;
        const needsAgeCheck = status === 'approved' || (status === 'vetting' && !age_verified_at);
        return needsAgeCheck ? 'age-verification' : status;
      }
      case 'none':
        return 'onboarding';
      case 'signed-out':
        return 'loading'; // briefly, until the sign-out navigation completes
      default:
        return state.kind;
    }
  });

  /** Whether an admin has approved the application yet, for the age check's wording. */
  readonly approved = computed(() => {
    const state = this.state();
    return state.kind === 'loaded' && state.profile.status === 'approved';
  });

  retry() {
    this.profiles.refresh();
  }
}
