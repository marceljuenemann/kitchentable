import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { andList } from '../../../core/and-list';
import { AddValueFieldComponent } from '../../../shared/add-value-field/add-value-field.component';
import { OnboardingDraftStore, STEPS_SHOWN } from '../onboarding-draft.store';
import {
  ABOUT_MIN_LENGTH,
  LOOKING_FOR_OPTIONS,
  TAGLINE_MAX_LENGTH,
  lookingForLabel,
  lookingForValueFor,
} from '../../../core/profile-options';

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
  readonly totalSteps = STEPS_SHOWN;
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

  /** What's still needed, so the disabled button can say why. */
  readonly missing = computed(() => {
    const left = this.aboutLeft();
    return [
      left > 0 && `write ${left} more character${left === 1 ? '' : 's'} about yourself`,
      this.draft().lookingFor.length === 0 && "pick what you're looking for",
    ].filter((item): item is string => !!item);
  });
  readonly canContinue = computed(() => this.missing().length === 0);
  readonly hint = computed(() => {
    if (this.canContinue()) return '';
    const missing = andList(this.missing());
    return `${missing[0].toUpperCase()}${missing.slice(1)} to continue.`;
  });

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
