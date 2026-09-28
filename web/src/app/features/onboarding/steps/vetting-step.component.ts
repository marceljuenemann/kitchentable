import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { OnboardingDraftStore, ONBOARDING_STEPS } from '../onboarding-draft.store';
import { VETTING_MIN_LENGTH, VETTING_QUESTIONS } from '../onboarding-options';

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

  readonly draft = this.store.draft;
  readonly totalSteps = ONBOARDING_STEPS;
  readonly questions = VETTING_QUESTIONS;

  /** How many more characters each question needs, by question id. */
  readonly charsToGo = computed(() =>
    Object.fromEntries(
      VETTING_QUESTIONS.map((question) => [
        question.id,
        Math.max(VETTING_MIN_LENGTH - this.length(question.id), 0),
      ]),
    ),
  );

  readonly canSubmit = computed(() =>
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

  submit() {
    if (!this.canSubmit()) return;
    // TODO: Submit the application (creates the profile row) once `submit_onboarding` exists.
  }
}
