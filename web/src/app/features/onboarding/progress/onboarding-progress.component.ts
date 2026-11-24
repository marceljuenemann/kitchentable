import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { STEPS_SHOWN } from '../onboarding-draft.store';

/**
 * The onboarding progress bar, with a back button before it from the second step. Also on the
 * age check, the last step, which comes after submitting and so has no back button.
 */
@Component({
  selector: 'app-onboarding-progress',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatProgressBarModule],
  templateUrl: './onboarding-progress.component.html',
  styleUrl: './onboarding-progress.component.scss',
})
export class OnboardingProgressComponent {
  /** 1 to STEPS_SHOWN. */
  readonly step = input.required<number>();
  readonly canGoBack = input(false);
  readonly back = output<void>();

  readonly totalSteps = STEPS_SHOWN;
}
