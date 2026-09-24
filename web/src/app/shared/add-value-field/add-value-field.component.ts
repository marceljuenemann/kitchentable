import { Component, computed, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

/**
 * A text field with an "Add" button inside it, for entering your own value next to a list of
 * standard options. Emits the trimmed value and clears itself; Enter also adds.
 */
@Component({
  selector: 'app-add-value-field',
  standalone: true,
  imports: [MatButtonModule, MatFormFieldModule, MatInputModule],
  templateUrl: './add-value-field.component.html',
  styleUrl: './add-value-field.component.scss',
})
export class AddValueFieldComponent {
  readonly label = input.required<string>();
  readonly placeholder = input('');
  /** Values for which Add is disabled (e.g. one that already exists). */
  readonly isDuplicate = input<(value: string) => boolean>(() => false);

  readonly added = output<string>();

  readonly value = signal('');
  readonly canAdd = computed(() => {
    const value = this.value().trim();
    return value !== '' && !this.isDuplicate()(value);
  });

  add() {
    if (!this.canAdd()) return;
    this.added.emit(this.value().trim());
    this.value.set('');
  }
}
