import { Component, computed, inject, signal } from '@angular/core';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { AddValueFieldComponent } from '../../add-value-field/add-value-field.component';

export interface OptionSheetData {
  title: string;
  help: string;
  options: string[];
  selected: string[];
  /** Multi-select shows chips and a Done button; single-select closes as soon as one is picked. */
  multi: boolean;
  placeholder: string;
  /** Theme colour of the selected chips; defaults to secondary. */
  accent?: 'primary' | 'secondary' | 'tertiary';
  /** Multi-select only: Done needs at least one picked. */
  required?: boolean;
  /** The text to show for a value, if the values are ids (like Looking for's). */
  label?: (value: string) => string;
  /** The value to store for something the user typed, if the values are ids. */
  valueFor?: (text: string) => string;
}

/** Bottom sheet to pick one or several options, or describe your own. Dismisses with the selection. */
@Component({
  selector: 'app-option-sheet',
  standalone: true,
  imports: [MatButtonModule, MatChipsModule, AddValueFieldComponent],
  templateUrl: './option-sheet.component.html',
  styleUrl: './option-sheet.component.scss',
})
export class OptionSheetComponent {
  private readonly ref =
    inject<MatBottomSheetRef<OptionSheetComponent, string[]>>(MatBottomSheetRef);
  readonly data = inject<OptionSheetData>(MAT_BOTTOM_SHEET_DATA);

  readonly selected = signal(this.data.selected);
  /** The given options plus any custom values chosen earlier or added here. */
  readonly options = signal([
    ...this.data.options,
    ...this.data.selected.filter((value) => !this.data.options.includes(value)),
  ]);

  readonly label = this.data.label ?? ((value: string) => value);
  private readonly valueFor = this.data.valueFor ?? ((text: string) => text);
  readonly canFinish = computed(() => !this.data.required || this.selected().length > 0);

  readonly isDuplicate = (text: string) => {
    const value = this.valueFor(text).toLowerCase();
    return this.options().some((option) => option.toLowerCase() === value);
  };

  pick(value: string) {
    this.ref.dismiss([value]);
  }

  /**
   * Multi-select updates the selection; single-select picks and closes (ignoring un-selecting).
   *
   * `mat-chip-listbox` reports the new selection in the chips' display order, not the order
   * they were picked in. We want the pick order (it becomes the display order for the field,
   * e.g. gender tags on a profile), so keep the existing order for values that are still
   * selected and append newly-picked ones at the end.
   */
  onChange(value: string | string[] | undefined) {
    if (this.data.multi) {
      const next = new Set(value as string[]);
      const stillSelected = this.selected().filter((option) => next.has(option));
      const newlyPicked = (value as string[]).filter((option) => !stillSelected.includes(option));
      this.selected.set([...stillSelected, ...newlyPicked]);
    } else if (value !== undefined) {
      this.pick(value as string);
    }
  }

  addCustom(text: string) {
    const value = this.valueFor(text);
    this.options.update((options) => [...options, value]);
    if (this.data.multi) {
      this.selected.update((selected) => [...selected, value]);
    } else {
      this.pick(value);
    }
  }

  clear() {
    this.selected.set([]);
  }

  done() {
    if (this.canFinish()) this.ref.dismiss(this.selected());
  }
}
