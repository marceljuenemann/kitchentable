import { Component, inject } from '@angular/core';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { PolicyComponent, PolicyId } from './policy.component';

export interface PolicySheetData {
  policy: PolicyId;
}

/** A legal document in a bottom sheet. Open it with `openPolicySheet()`. */
@Component({
  selector: 'app-policy-sheet',
  standalone: true,
  imports: [MatButtonModule, PolicyComponent],
  templateUrl: './policy-sheet.component.html',
  styleUrl: './policy-sheet.component.scss',
})
export class PolicySheetComponent {
  private readonly sheetRef = inject(MatBottomSheetRef);
  readonly data = inject<PolicySheetData>(MAT_BOTTOM_SHEET_DATA);

  close() {
    this.sheetRef.dismiss();
  }
}
