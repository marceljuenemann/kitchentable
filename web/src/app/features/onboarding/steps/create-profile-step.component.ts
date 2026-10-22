import { Component, computed, inject } from '@angular/core';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { AgeSheetComponent, ageFrom } from '../age-sheet/age-sheet.component';
import { LocationSheetComponent } from '../location-sheet/location-sheet.component';
import { OptionSheetComponent, OptionSheetData } from '../option-sheet/option-sheet.component';
import { OnboardingDraftStore, ONBOARDING_STEPS } from '../onboarding-draft.store';
import { GENDER_OPTIONS, PRONOUN_OPTIONS, SEXUALITY_OPTIONS } from '../onboarding-options';

const SHEET_CONFIG = {
  panelClass: 'kt-bottom-sheet',
  // Focus the sheet itself rather than its first button (which would be "Clear").
  autoFocus: 'dialog',
} as const;

type ListField = 'pronouns' | 'gender' | 'sexuality';

interface Row {
  key: ListField | 'age' | 'location';
  label: string;
  required: boolean;
  emptyText: string;
  value: string;
}

const SHEETS: Record<ListField, Omit<OptionSheetData, 'selected'>> = {
  pronouns: {
    title: 'Pronouns',
    help: "Choose what you'd like to show on your profile.",
    options: PRONOUN_OPTIONS,
    multi: false,
    placeholder: 'e.g. ze/hir',
    accent: 'primary',
  },
  gender: {
    title: 'Gender',
    help: "Choose what you'd like to show on your profile.",
    options: GENDER_OPTIONS,
    multi: true,
    placeholder: 'e.g. Demiboy, Transfeminine',
  },
  sexuality: {
    title: 'Sexuality',
    help: "Choose what you'd like to show on your profile.",
    options: SEXUALITY_OPTIONS,
    multi: true,
    placeholder: 'e.g. sapphic, achillean',
    accent: 'tertiary',
  },
};

/** Onboarding step 1: name, pronouns, gender, sexuality, age and location. */
@Component({
  selector: 'app-create-profile-step',
  standalone: true,
  imports: [MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule],
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
        label: 'Pronouns',
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
        value: age === null ? '' : `${age}`,
      },
      {
        key: 'location',
        label: 'Location',
        required: true,
        emptyText: 'Add location',
        value: draft.location,
      },
    ];
  });

  readonly canContinue = computed(() => {
    const draft = this.draft();
    return draft.name.trim() !== '' && draft.pronouns.length > 0 && draft.location.trim() !== '';
  });

  setName(name: string) {
    this.store.update({ name });
  }

  openRow(key: Row['key']) {
    if (key === 'location') {
      this.bottomSheet
        .open(LocationSheetComponent, {
          ...SHEET_CONFIG,
          data: { location: this.draft().location },
        })
        .afterDismissed()
        .subscribe((location) => location && this.store.update({ location }));
      return;
    }
    if (key === 'age') {
      const { birthMonth, birthYear } = this.draft();
      this.bottomSheet
        .open(AgeSheetComponent, { ...SHEET_CONFIG, data: { birthMonth, birthYear } })
        .afterDismissed()
        .subscribe((result) => result && this.store.update(result));
      return;
    }
    this.bottomSheet
      .open(OptionSheetComponent, {
        ...SHEET_CONFIG,
        data: { ...SHEETS[key], selected: this.draft()[key] },
      })
      .afterDismissed()
      .subscribe((result) => result && this.store.update({ [key]: result }));
  }

  next() {
    if (this.canContinue()) this.store.update({ step: 2 });
  }
}
