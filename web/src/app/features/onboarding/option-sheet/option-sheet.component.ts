import { Component, inject, signal } from '@angular/core';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { AddValueFieldComponent } from '../../../shared/add-value-field/add-value-field.component';

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

  readonly isDuplicate = (value: string) =>
    this.options().some((option) => option.toLowerCase() === value.toLowerCase());

  pick(value: string) {
    this.ref.dismiss([value]);
  }

  /** Multi-select updates the selection; single-select picks and closes (ignoring un-selecting). */
  onChange(value: string | string[] | undefined) {
    if (this.data.multi) {
      this.selected.set(value as string[]);
    } else if (value !== undefined) {
      this.pick(value as string);
    }
  }

  addCustom(value: string) {
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
    this.ref.dismiss(this.selected());
  }
}
