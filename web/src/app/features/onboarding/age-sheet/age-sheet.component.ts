import { Component, computed, inject, signal } from '@angular/core';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';

export interface AgeSheetData {
  birthMonth: string;
  birthYear: string;
}

export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** Years someone can be born in: 18 years ago and the 73 before that. */
export function birthYearOptions(now = new Date()): number[] {
  const newest = now.getFullYear() - 18;
  return Array.from({ length: 74 }, (_, i) => newest - i);
}

/** Age today, or null if month/year aren't both set. Day of birth is deliberately not collected. */
export function ageFrom(month: string, year: string, now = new Date()): number | null {
  if (!month || !year) return null;
  const birthMonth = Number(month);
  return now.getFullYear() - Number(year) - (now.getMonth() + 1 < birthMonth ? 1 : 0);
}

/** Bottom sheet to pick a birth month and year. Dismisses with both values ("" if cleared). */
@Component({
  selector: 'app-age-sheet',
  standalone: true,
  imports: [MatButtonModule, MatFormFieldModule, MatSelectModule],
  templateUrl: './age-sheet.component.html',
  styleUrl: './age-sheet.component.scss',
})
export class AgeSheetComponent {
  private readonly ref =
    inject<MatBottomSheetRef<AgeSheetComponent, AgeSheetData>>(MatBottomSheetRef);
  private readonly data = inject<AgeSheetData>(MAT_BOTTOM_SHEET_DATA);

  readonly months = MONTHS;
  readonly years = birthYearOptions();

  readonly month = signal(this.data.birthMonth);
  readonly year = signal(this.data.birthYear);
  readonly age = computed(() => ageFrom(this.month(), this.year()));

  done() {
    this.ref.dismiss({ birthMonth: this.month(), birthYear: this.year() });
  }
}
