import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ProfileService } from '../../../core/profile.service';
import { OnboardingDraftStore, ONBOARDING_STEPS, toNewProfile } from '../onboarding-draft.store';
import {
  ONBOARDING_FEEDBACK_ID,
  VETTING_MIN_LENGTH,
  VETTING_QUESTIONS,
} from '../onboarding-options';

/** Onboarding step 4: the private vetting questions, then submit. */
@Component({
  selector: 'app-vetting-step',
  standalone: true,
  imports: [MatButtonModule, MatFormFieldModule, MatInputModule],
  templateUrl: './vetting-step.component.html',
  styleUrl: './vetting-step.component.scss',
})
export class VettingStepComponent {
  private readonly store = inject(OnboardingDraftStore);
  private readonly profiles = inject(ProfileService);

  readonly draft = this.store.draft;
  readonly submitting = signal(false);
  readonly failed = signal(false);
  readonly totalSteps = ONBOARDING_STEPS;
  readonly questions = VETTING_QUESTIONS;
  readonly minLength = VETTING_MIN_LENGTH;
  readonly feedbackId = ONBOARDING_FEEDBACK_ID;

  /** How many more characters each question needs, by question id. */
  readonly charsToGo = computed(() =>
    Object.fromEntries(
      VETTING_QUESTIONS.map((question) => [
        question.id,
        Math.max(VETTING_MIN_LENGTH - this.length(question.id), 0),
      ]),
    ),
  );

  readonly canSubmit = computed(
    () =>
      !this.submitting() &&
      VETTING_QUESTIONS.every((question) => this.length(question.id) >= VETTING_MIN_LENGTH),
  );

  /** The answer so far; a question that hasn't been touched has no entry. */
  answer(id: string): string {
    return this.draft().vettingAnswers[id] ?? '';
  }

  length(id: string): number {
    return this.answer(id).trim().length;
  }

  setAnswer(id: string, text: string) {
    this.store.update({ vettingAnswers: { ...this.draft().vettingAnswers, [id]: text } });
  }

  /** Creates the profile; the shell then shows the next screen, so nothing is navigated here. */
  async submit() {
    if (!this.canSubmit()) return;
    this.submitting.set(true);
    this.failed.set(false);
    try {
      await this.profiles.submitOnboarding(toNewProfile(this.draft()));
    } catch {
      this.failed.set(true);
      this.submitting.set(false);
    }
  }
}
