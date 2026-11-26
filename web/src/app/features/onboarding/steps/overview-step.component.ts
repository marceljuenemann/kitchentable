import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { OnboardingDraftStore } from '../onboarding-draft.store';

/**
 * Onboarding step 0, before the form: that the draft is kept in this browser, the steps, and what
 * happens after them. Keep `steps` in step with the steps' titles and the age check.
 */
@Component({
  selector: 'app-overview-step',
  standalone: true,
  imports: [MatButtonModule],
  templateUrl: './overview-step.component.html',
  styleUrl: './overview-step.component.scss',
})
export class OverviewStepComponent {
  private readonly store = inject(OnboardingDraftStore);

  readonly steps = [
    'Add profile data',
    'Write about yourself',
    'Upload photos',
    'Selfie age check',
  ];

  start() {
    this.store.update({ step: 1 });
  }
}
