import { Component, computed, inject } from '@angular/core';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { AgeSheetComponent, ageFrom, MONTHS } from '../age-sheet/age-sheet.component';
import { OptionSheetComponent, OptionSheetData } from '../option-sheet/option-sheet.component';
import { OnboardingLocation } from '../onboarding-draft.store';
import { OnboardingDraftStore, ONBOARDING_STEPS } from '../onboarding-draft.store';
import { GENDER_OPTIONS, PRONOUN_OPTIONS, SEXUALITY_OPTIONS } from '../onboarding-options';

type ListField = 'pronouns' | 'gender' | 'sexuality';

interface Row {
  key: ListField | 'age';
  label: string;
  required: boolean;
  emptyText: string;
  value: string;
}

const SHEETS: Record<ListField, Omit<OptionSheetData, 'selected'>> = {
  pronouns: {
    title: 'Preferred pronouns',
    help: 'Pick one, or add your own.',
    options: PRONOUN_OPTIONS,
    multi: false,
    placeholder: 'e.g. ze/hir',
  },
  gender: {
    title: 'Gender',
    help: 'Pick any that apply, or add your own. Shown on your profile.',
    options: GENDER_OPTIONS,
    multi: true,
    placeholder: 'e.g. genderfluid, bigender',
  },
  sexuality: {
    title: 'Sexuality',
    help: 'Pick any that apply, or add your own.',
    options: SEXUALITY_OPTIONS,
    multi: true,
    placeholder: 'e.g. sapphic, achillean',
  },
};

/** Onboarding step 1: name, pronouns, gender, sexuality, age and location. */
@Component({
  selector: 'app-create-profile-step',
  standalone: true,
  imports: [MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatRadioModule],
  templateUrl: './create-profile-step.component.html',
  styleUrl: './create-profile-step.component.scss',
})
export class CreateProfileStepComponent {
  private readonly store = inject(OnboardingDraftStore);
  private readonly bottomSheet = inject(MatBottomSheet);

  readonly draft = this.store.draft;
  readonly totalSteps = ONBOARDING_STEPS;

  readonly rows = computed<Row[]>(() => {
    const draft = this.draft();
    const age = ageFrom(draft.birthMonth, draft.birthYear);
    return [
      {
        key: 'pronouns',
        label: 'Preferred pronouns',
        required: true,
        emptyText: 'Add pronouns',
        value: draft.pronouns.join(', '),
      },
      {
        key: 'gender',
        label: 'Gender',
        required: false,
        emptyText: 'Add gender',
        value: draft.gender.join(', '),
      },
      {
        key: 'sexuality',
        label: 'Sexuality',
        required: false,
        emptyText: 'Add sexuality',
        value: draft.sexuality.join(', '),
      },
      {
        key: 'age',
        label: 'Age',
        required: false,
        emptyText: 'Add birthday',
        value:
          age === null ? '' : `${MONTHS[Number(draft.birthMonth) - 1]} ${draft.birthYear} (${age})`,
      },
    ];
  });

  readonly canContinue = computed(() => {
    const draft = this.draft();
    return (
      draft.name.trim() !== '' &&
      draft.pronouns.length > 0 &&
      (draft.location === 'London' || draft.locationOther.trim() !== '')
    );
  });

  setName(name: string) {
    this.store.update({ name });
  }

  setLocation(location: OnboardingLocation) {
    this.store.update({ location });
  }

  setLocationOther(locationOther: string) {
    this.store.update({ locationOther });
  }

  openRow(key: Row['key']) {
    if (key === 'age') {
      const { birthMonth, birthYear } = this.draft();
      this.bottomSheet
        .open(AgeSheetComponent, { panelClass: 'kt-bottom-sheet', data: { birthMonth, birthYear } })
        .afterDismissed()
        .subscribe((result) => result && this.store.update(result));
      return;
    }
    this.bottomSheet
      .open(OptionSheetComponent, {
        panelClass: 'kt-bottom-sheet',
        data: { ...SHEETS[key], selected: this.draft()[key] },
      })
      .afterDismissed()
      .subscribe((result) => result && this.store.update({ [key]: result }));
  }

  next() {
    if (this.canContinue()) this.store.update({ step: 2 });
  }
}
