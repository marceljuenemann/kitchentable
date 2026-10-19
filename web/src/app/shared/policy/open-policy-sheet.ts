import { MatBottomSheet } from '@angular/material/bottom-sheet';
import type { PolicyId } from './policy.component';

/**
 * Opens a legal document in a bottom sheet. The sheet is loaded only then, so the documents and
 * the Markdown parser stay out of the bundle of the screen that links to them.
 */
export async function openPolicySheet(bottomSheet: MatBottomSheet, policy: PolicyId) {
  const { PolicySheetComponent } = await import('./policy-sheet.component');
  bottomSheet.open(PolicySheetComponent, {
    panelClass: 'kt-bottom-sheet',
    autoFocus: 'dialog',
    data: { policy },
  });
}
