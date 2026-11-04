import { Component, inject, signal } from '@angular/core';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export type ConversationSheetResult = 'profile' | 'report' | 'end';

export interface ConversationSheetData {
  name: string;
  /** Only an accepted connection can be ended (`end_connection`), and not one with the admins. */
  canEnd: boolean;
  /** Reports go to the conversation with the team, which admins don't have. */
  canReport: boolean;
}

/** What you can do about a conversation. Ending one is final, so it asks first. */
@Component({
  selector: 'app-conversation-sheet',
  standalone: true,
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './conversation-sheet.component.html',
  styleUrl: './conversation-sheet.component.scss',
})
export class ConversationSheetComponent {
  private readonly ref =
    inject<MatBottomSheetRef<ConversationSheetComponent, ConversationSheetResult>>(
      MatBottomSheetRef,
    );

  readonly data = inject<ConversationSheetData>(MAT_BOTTOM_SHEET_DATA);
  readonly name = this.data.name;
  readonly confirmingEnd = signal(false);

  choose(result: ConversationSheetResult) {
    this.ref.dismiss(result);
  }

  cancel() {
    this.ref.dismiss();
  }
}
