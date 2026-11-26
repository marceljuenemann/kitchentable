import { Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { STEPS_SHOWN } from '../onboarding-draft.store';

/**
 * The onboarding progress bar, with a back button before it from step 1. Also on the overview
 * (step 0), and on the age check, the last step, which comes after submitting and so has no back
 * button.
 */
@Component({
  selector: 'app-onboarding-progress',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatProgressBarModule],
  templateUrl: './onboarding-progress.component.html',
  styleUrl: './onboarding-progress.component.scss',
})
export class OnboardingProgressComponent {
  /** 0 (the overview) to STEPS_SHOWN. */
  readonly step = input.required<number>();
  readonly canGoBack = input(false);
  readonly back = output<void>();

  readonly totalSteps = STEPS_SHOWN;

  /** On the overview, half a step, so the bar has started rather than looking empty. */
  readonly percent = computed(() => (Math.max(this.step(), 0.5) / this.totalSteps) * 100);

  readonly label = computed(() =>
    this.step() === 0
      ? `Before step 1 of ${this.totalSteps}`
      : `Step ${this.step()} of ${this.totalSteps}`,
  );
}
