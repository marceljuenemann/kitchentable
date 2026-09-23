import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ProfileService, ProfileState } from '../../core/profile.service';
import { FooterComponent } from '../../shared/footer/footer.component';
import { HeaderComponent } from '../../shared/header/header.component';
import { AgeVerificationComponent } from '../age-verification/age-verification.component';
import { MainComponent } from '../main/main.component';
import { OnboardingComponent } from '../onboarding/onboarding.component';
import { VettingComponent } from '../vetting/vetting.component';

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
    MatProgressSpinnerModule,
    FooterComponent,
    HeaderComponent,
    AgeVerificationComponent,
    MainComponent,
    OnboardingComponent,
    VettingComponent,
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
      case 'loaded':
        return state.profile.status;
      case 'none':
        return 'onboarding';
      case 'signed-out':
        return 'loading'; // briefly, until the sign-out navigation completes
      default:
        return state.kind;
    }
  });

  retry() {
    this.profiles.refresh();
  }
}
