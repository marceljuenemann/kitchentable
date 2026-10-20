import { MatBottomSheet, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import type { PolicyId } from './policy.component';

/**
 * Opens a legal document in a bottom sheet. The sheet is loaded only then, so the documents and
 * the Markdown parser stay out of the bundle of the screen that links to them. Only one bottom
 * sheet can be open at a time, so this closes any other.
 */
export async function openPolicySheet(
  bottomSheet: MatBottomSheet,
  policy: PolicyId,
): Promise<MatBottomSheetRef> {
  const { PolicySheetComponent } = await import('./policy-sheet.component');
  return bottomSheet.open(PolicySheetComponent, {
    panelClass: ['kt-bottom-sheet', 'kt-bottom-sheet-inner-scroll'],
    autoFocus: 'dialog',
    data: { policy },
  });
}
