import { Component, computed, inject } from '@angular/core';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { ageFrom } from '../../../core/age';
import { AgeSheetComponent } from '../../../shared/profile-edit/age-sheet/age-sheet.component';
import {
  LIST_FIELD_SHEETS,
  ListField,
  PROFILE_SHEET_CONFIG,
} from '../../../shared/profile-edit/field-sheets';
import { LocationSheetComponent } from '../../../shared/profile-edit/location-sheet/location-sheet.component';
import { OptionSheetComponent } from '../../../shared/profile-edit/option-sheet/option-sheet.component';
import { OnboardingDraftStore, ONBOARDING_STEPS } from '../onboarding-draft.store';

interface Row {
  key: ListField | 'age' | 'location';
  label: string;
  required: boolean;
  emptyText: string;
  value: string;
}

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
          ...PROFILE_SHEET_CONFIG,
          data: { location: this.draft().location },
        })
        .afterDismissed()
        .subscribe((location) => location && this.store.update({ location }));
      return;
    }
    if (key === 'age') {
      const { birthMonth, birthYear } = this.draft();
      this.bottomSheet
        .open(AgeSheetComponent, { ...PROFILE_SHEET_CONFIG, data: { birthMonth, birthYear } })
        .afterDismissed()
        .subscribe((result) => result && this.store.update(result));
      return;
    }
    this.bottomSheet
      .open(OptionSheetComponent, {
        ...PROFILE_SHEET_CONFIG,
        data: { ...LIST_FIELD_SHEETS[key], selected: this.draft()[key] },
      })
      .afterDismissed()
      .subscribe((result) => result && this.store.update({ [key]: result }));
  }

  next() {
    if (this.canContinue()) this.store.update({ step: 2 });
  }
}
