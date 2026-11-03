import { Component, computed, inject, signal } from '@angular/core';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';

export const LONDON = 'London';

export interface LocationSheetData {
  /** "London" or another city. */
  location: string;
}

/** Bottom sheet to pick London or enter another city. Dismisses with the location string. */
@Component({
  selector: 'app-location-sheet',
  standalone: true,
  imports: [MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatRadioModule],
  templateUrl: './location-sheet.component.html',
  styleUrl: './location-sheet.component.scss',
})
export class LocationSheetComponent {
  private readonly ref =
    inject<MatBottomSheetRef<LocationSheetComponent, string>>(MatBottomSheetRef);
  private readonly data = inject<LocationSheetData>(MAT_BOTTOM_SHEET_DATA);

  readonly inLondon = signal(this.data.location === LONDON);
  readonly city = signal(this.inLondon() ? '' : this.data.location);
  readonly canSave = computed(() => this.inLondon() || this.city().trim() !== '');

  save() {
    if (this.canSave()) this.ref.dismiss(this.inLondon() ? LONDON : this.city().trim());
  }
}
