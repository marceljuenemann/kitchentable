import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AddValueFieldComponent } from '../../../shared/add-value-field/add-value-field.component';
import { OnboardingDraftStore, ONBOARDING_STEPS } from '../onboarding-draft.store';
import {
  ABOUT_MIN_LENGTH,
  LOOKING_FOR_OPTIONS,
  TAGLINE_MAX_LENGTH,
  lookingForLabel,
  lookingForValueFor,
} from '../onboarding-options';

/** Onboarding step 2: tagline, about text and what the user is looking for. */
@Component({
  selector: 'app-about-you-step',
  standalone: true,
  imports: [
    MatButtonModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    AddValueFieldComponent,
  ],
  templateUrl: './about-you-step.component.html',
  styleUrl: './about-you-step.component.scss',
})
export class AboutYouStepComponent {
  private readonly store = inject(OnboardingDraftStore);

  readonly draft = this.store.draft;
  readonly totalSteps = ONBOARDING_STEPS;
  readonly taglineMax = TAGLINE_MAX_LENGTH;
  readonly aboutMin = ABOUT_MIN_LENGTH;
  readonly label = lookingForLabel;

  readonly taglineLeft = computed(() => TAGLINE_MAX_LENGTH - this.draft().tagline.length);
  readonly aboutLength = computed(() => this.draft().aboutText.trim().length);
  readonly aboutLeft = computed(() => Math.max(ABOUT_MIN_LENGTH - this.aboutLength(), 0));

  /** Standard options first, then the user's own entries. */
  readonly options = computed(() => {
    const standard = LOOKING_FOR_OPTIONS.map((option) => option.id);
    const own = this.draft().lookingFor.filter((value) => !standard.includes(value));
    return [...standard, ...own];
  });

  readonly canContinue = computed(
    () => this.aboutLength() >= ABOUT_MIN_LENGTH && this.draft().lookingFor.length > 0,
  );

  readonly isDuplicate = (text: string) => this.options().includes(lookingForValueFor(text));

  setTagline(tagline: string) {
    this.store.update({ tagline });
  }

  setAbout(aboutText: string) {
    this.store.update({ aboutText });
  }

  setLookingFor(lookingFor: string[]) {
    this.store.update({ lookingFor });
  }

  addOwn(text: string) {
    this.setLookingFor([...this.draft().lookingFor, lookingForValueFor(text)]);
  }

  next() {
    if (this.canContinue()) this.store.update({ step: 3 });
  }
}
