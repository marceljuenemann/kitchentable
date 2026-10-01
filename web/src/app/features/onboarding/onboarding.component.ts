import { Component, computed, effect, HostListener, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { AnalyticsService } from '../../core/analytics.service';
import { FooterComponent } from '../../shared/footer/footer.component';
import { HeaderComponent } from '../../shared/header/header.component';
import { ONBOARDING_STEPS, OnboardingDraftStore } from './onboarding-draft.store';
import { AboutYouStepComponent } from './steps/about-you-step.component';
import { CreateProfileStepComponent } from './steps/create-profile-step.component';
import { PhotosStepComponent } from './steps/photos-step.component';
import { VettingStepComponent } from './steps/vetting-step.component';

/** The onboarding flow: header with progress, the current step, footer. */
@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    AboutYouStepComponent,
    CreateProfileStepComponent,
    FooterComponent,
    HeaderComponent,
    PhotosStepComponent,
    VettingStepComponent,
  ],
  providers: [OnboardingDraftStore],
  templateUrl: './onboarding.component.html',
  styleUrl: './onboarding.component.scss',
})
export class OnboardingComponent {
  private readonly store = inject(OnboardingDraftStore);
  private readonly analytics = inject(AnalyticsService);

  readonly draft = this.store.draft;
  readonly step = computed(() => this.draft().step);
  readonly totalSteps = ONBOARDING_STEPS;

  constructor() {
    // Every step starts at the top.
    // TODO: This should trigger when the step changes.
    effect(() => {
      this.step();
      window.scrollTo(0, 0);
    });

    // To see where people drop off in onboarding.
    effect(() => this.analytics.track('onboarding_step_viewed', { step: this.step() }));
  }

  back() {
    this.store.update({ step: this.draft().step - 1 });
  }

  @HostListener('window:pagehide')
  saveDraft() {
    this.store.flush();
  }
}
