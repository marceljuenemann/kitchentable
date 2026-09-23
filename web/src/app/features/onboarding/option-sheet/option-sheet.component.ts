import { Component, computed, inject, signal } from '@angular/core';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';

export interface OptionSheetData {
  title: string;
  help: string;
  options: string[];
  selected: string[];
  /** Multi-select shows chips and a Done button; single-select closes as soon as one is picked. */
  multi: boolean;
  placeholder: string;
  /** Theme colour of the selected chips; defaults to secondary. */
  accent?: 'secondary' | 'tertiary';
}

/** Bottom sheet to pick one or several options, or describe your own. Dismisses with the selection. */
@Component({
  selector: 'app-option-sheet',
  standalone: true,
  imports: [MatButtonModule, MatChipsModule, MatFormFieldModule, MatInputModule, MatRadioModule],
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

  readonly custom = signal('');
  readonly canAddCustom = computed(() => {
    const value = this.custom().trim().toLowerCase();
    return value !== '' && !this.options().some((option) => option.toLowerCase() === value);
  });

  pick(value: string) {
    this.ref.dismiss([value]);
  }

  setSelected(values: string[]) {
    this.selected.set(values);
  }

  addCustom() {
    if (!this.canAddCustom()) return;
    const value = this.custom().trim();
    this.options.update((options) => [...options, value]);
    this.custom.set('');
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
