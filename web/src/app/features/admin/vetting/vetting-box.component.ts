import { DatePipe } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { ONBOARDING_FEEDBACK_ID, VETTING_QUESTIONS } from '../../onboarding/onboarding-options';
import { Application } from './vetting.store';

const INVITE_CODE_KEY = 'invite_code';

/**
 * The vetting answers under their questions, in the order onboarding asks them. An answer to a
 * question that is no longer asked comes last, under its id. The invite code and the onboarding
 * feedback are shown separately.
 */
export function vettingAnswers(answers: Record<string, string>): { label: string; text: string }[] {
  const asked = VETTING_QUESTIONS.filter(({ id }) => answers[id]).map(({ id, prompt }) => ({
    label: prompt,
    text: answers[id],
  }));
  const known = new Set<string>([
    ...VETTING_QUESTIONS.map(({ id }) => id),
    INVITE_CODE_KEY,
    ONBOARDING_FEEDBACK_ID,
  ]);
  const other = Object.keys(answers)
    .filter((key) => !known.has(key))
    .map((key) => ({ label: key, text: answers[key] }));
  return [...asked, ...other];
}

/** What only the admin sees of an application, and the Approve button. */
@Component({
  selector: 'app-vetting-box',
  standalone: true,
  imports: [DatePipe, MatButtonModule],
  templateUrl: './vetting-box.component.html',
  styleUrl: './vetting-box.component.scss',
})
export class VettingBoxComponent {
  readonly application = input.required<Application>();
  readonly busy = input(false);
  readonly failed = input(false);
  readonly approve = output<void>();

  readonly answers = computed(() => vettingAnswers(this.application().vetting_answers));
  readonly inviteCode = computed(() => this.application().vetting_answers[INVITE_CODE_KEY]);
  readonly feedback = computed(() => this.application().vetting_answers[ONBOARDING_FEEDBACK_ID]);
}
