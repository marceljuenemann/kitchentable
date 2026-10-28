import { Component, computed, inject, signal, ViewContainerRef } from '@angular/core';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { RouterOutlet } from '@angular/router';
import { InviteLinkComponent } from '../../../shared/invite-link/invite-link.component';
import {
  ProfileGridComponent,
  ProfileTile,
} from '../../../shared/profile-grid/profile-grid.component';
import { FilterField, FilterSheetComponent } from './filter-sheet.component';
import {
  AGE_MAX,
  ageRanged,
  GENDER_FILTERS,
  LOOKING_FOR_FILTERS,
  SearchStore,
} from './search.store';

interface FilterPill {
  field: FilterField;
  label: string;
  /** How many values are picked (Age: none). */
  count: number;
  active: boolean;
  ariaLabel: string;
}

/**
 * The Search tab (prototype/browse): filters, then the members as a grid. A tile swiped left
 * hides that person; tapping one opens their profile over the grid as a child route.
 */
@Component({
  selector: 'app-search',
  standalone: true,
  imports: [RouterOutlet, InviteLinkComponent, ProfileGridComponent],
  templateUrl: './search.component.html',
  styleUrl: './search.component.scss',
  host: {
    // Over the bottom nav while a profile shows: the page is its own stacking context (it's
    // fixed), so the profile's z-index only counts within it.
    '[class.covering]': 'store.openId() !== null',
  },
})
export class SearchComponent {
  readonly store = inject(SearchStore);
  private readonly bottomSheet = inject(MatBottomSheet);
  private readonly viewContainerRef = inject(ViewContainerRef);

  readonly tiles = computed<ProfileTile[]>(() =>
    this.store.results().map(({ id, name, tagline }) => ({
      id,
      name,
      tagline,
      photoUrl: this.store.photoUrls().get(id)?.[0] ?? null,
    })),
  );
  readonly count = computed(() => {
    const count = this.tiles().length;
    return count === 1 ? '1 person found' : `${count} people found`;
  });
  /** The filter whose sheet is open. */
  readonly openField = signal<FilterField | null>(null);

  readonly pills = computed<FilterPill[]>(() => {
    const filters = this.store.filters();
    // In the sheet's order, not the order they were picked in.
    const labels = (options: { value: string; label: string }[], picked: string[]) =>
      options.filter(({ value }) => picked.includes(value)).map(({ label }) => label);
    const lookingFor = labels(LOOKING_FOR_FILTERS, filters.lookingFor);
    const gender = labels(GENDER_FILTERS, filters.gender);
    const choice = (field: FilterField, label: string, values: string[]): FilterPill => ({
      field,
      label,
      count: values.length,
      active: values.length > 0,
      ariaLabel: `${label}, ${values.length > 0 ? values.join(', ') : 'any'}`,
    });
    let range = 'any';
    if (filters.maxAge < AGE_MAX) range = `${filters.minAge} to ${filters.maxAge}`;
    else if (ageRanged(filters)) range = `${filters.minAge} and older`;
    const withoutUnspecified = filters.showUnspecifiedAge ? '' : ', not profiles with no age';
    return [
      choice('lookingFor', 'Looking for', lookingFor),
      choice('gender', 'Gender', gender),
      {
        field: 'age',
        label: 'Age',
        count: 0,
        active: ageRanged(filters) || !filters.showUnspecifiedAge,
        ariaLabel: `Age, ${range}${withoutUnspecified}`,
      },
    ];
  });

  openFilter(field: FilterField) {
    this.openField.set(field);
    this.bottomSheet
      .open<FilterSheetComponent, FilterField>(FilterSheetComponent, {
        data: field,
        panelClass: 'kt-bottom-sheet',
        autoFocus: 'dialog',
        // So the sheet gets this route's SearchStore and changes the filters live.
        viewContainerRef: this.viewContainerRef,
      })
      .afterDismissed()
      .subscribe(() => this.openField.update((open) => (open === field ? null : open)));
  }

  hide(tile: ProfileTile) {
    const member = this.store.member(tile.id);
    if (member) this.store.hide(member);
  }
}
