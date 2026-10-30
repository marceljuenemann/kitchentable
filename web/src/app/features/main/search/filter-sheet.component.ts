import { Component, computed, inject } from '@angular/core';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatSliderModule } from '@angular/material/slider';
import {
  AGE_MAX,
  AGE_MIN,
  GENDER_FILTERS,
  LOOKING_FOR_FILTERS,
  NO_FILTERS,
  SearchStore,
} from './search.store';

export type FilterField = 'lookingFor' | 'gender' | 'age';

const CHOICES = {
  lookingFor: { title: 'Looking for', options: LOOKING_FOR_FILTERS },
  gender: { title: 'Gender', options: GENDER_FILTERS },
};

/**
 * Bottom sheet for one search filter: chips for Looking for and Gender (with a switch to be
 * shown only to the genders picked), a range slider for Age. Changes apply as they're made (the
 * grid behind updates), so its main button only closes it. Uses the SearchStore of the search
 * route it's opened from.
 */
@Component({
  selector: 'app-filter-sheet',
  standalone: true,
  imports: [MatButtonModule, MatChipsModule, MatSliderModule],
  templateUrl: './filter-sheet.component.html',
  styleUrl: './filter-sheet.component.scss',
})
export class FilterSheetComponent {
  private readonly ref = inject(MatBottomSheetRef);
  readonly store = inject(SearchStore);
  readonly field = inject<FilterField>(MAT_BOTTOM_SHEET_DATA);

  readonly choice = this.field === 'age' ? null : CHOICES[this.field];
  readonly title = this.choice?.title ?? 'Age';
  readonly ageMin = AGE_MIN;
  readonly ageMax = AGE_MAX;

  readonly picked = computed(() => (this.field === 'age' ? [] : this.store.filters()[this.field]));
  readonly onlyShowMe = this.store.hideByGender;
  readonly ageLabel = computed(() => {
    const { minAge, maxAge } = this.store.filters();
    if (maxAge < AGE_MAX) return `${minAge} to ${maxAge} years old`;
    return minAge > AGE_MIN ? `${minAge} and older` : 'Any age';
  });
  readonly showLabel = computed(() => {
    const count = this.store.results().length;
    return count === 1 ? 'Show 1 person' : `Show ${count} people`;
  });

  selectAll() {
    this.setPicked(this.choice?.options.map(({ value }) => value) ?? []);
  }

  setPicked(values: string[]) {
    if (this.field !== 'age') this.store.updateFilters({ [this.field]: values });
  }

  toggleOnlyShowMe() {
    this.store.setOnlyShowMeToGenders(!this.onlyShowMe());
  }

  setAge(edge: 'minAge' | 'maxAge', event: Event) {
    this.store.updateFilters({ [edge]: (event.target as HTMLInputElement).valueAsNumber });
  }

  toggleShowUnspecifiedAge() {
    this.store.updateFilters({ showUnspecifiedAge: !this.store.filters().showUnspecifiedAge });
  }

  /** Clears this filter only. */
  selectNone() {
    if (this.field === 'age') {
      const { minAge, maxAge, showUnspecifiedAge } = NO_FILTERS;
      this.store.updateFilters({ minAge, maxAge, showUnspecifiedAge });
    } else {
      this.setPicked([]);
    }
  }

  /** Clears this filter and closes. */
  clear() {
    this.selectNone();
    this.close();
  }

  close() {
    this.ref.dismiss();
  }
}
