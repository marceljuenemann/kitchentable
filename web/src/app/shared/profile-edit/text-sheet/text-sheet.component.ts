import { Component, computed, inject, signal } from '@angular/core';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ProfileTile, ProfileTileComponent } from '../../profile-grid/profile-tile.component';

export interface TextSheetData {
  title: string;
  help?: string;
  value: string;
  placeholder: string;
  /** A text area for paragraphs rather than one line. */
  multiline?: boolean;
  /** At most this many characters, counting down. */
  maxLength?: number;
  /** At least this many characters (trimmed), counting up until there are. */
  minLength?: number;
  /** Whether it may be left empty. */
  optional?: boolean;
  autocomplete?: string;
  /** Shows the profile's grid tile with the text as its tagline, updating as it's typed. */
  tile?: Pick<ProfileTile, 'id' | 'name' | 'photoUrl'>;
}

/** Bottom sheet to edit one text field. Dismisses with the trimmed text, or undefined if cancelled. */
@Component({
  selector: 'app-text-sheet',
  standalone: true,
  imports: [MatButtonModule, MatFormFieldModule, MatInputModule, ProfileTileComponent],
  templateUrl: './text-sheet.component.html',
  styleUrl: './text-sheet.component.scss',
})
export class TextSheetComponent {
  private readonly ref = inject<MatBottomSheetRef<TextSheetComponent, string>>(MatBottomSheetRef);
  readonly data = inject<TextSheetData>(MAT_BOTTOM_SHEET_DATA);

  readonly value = signal(this.data.value);
  readonly length = computed(() => this.value().trim().length);
  readonly left = computed(() => (this.data.maxLength ?? 0) - this.value().length);
  readonly missing = computed(() => Math.max((this.data.minLength ?? 0) - this.length(), 0));
  readonly canSave = computed(
    () => (this.data.optional || this.length() > 0) && this.missing() === 0,
  );
  readonly previewTile = computed<ProfileTile | null>(() =>
    this.data.tile ? { ...this.data.tile, tagline: this.value().trim() } : null,
  );

  save() {
    if (this.canSave()) this.ref.dismiss(this.value().trim());
  }
}
