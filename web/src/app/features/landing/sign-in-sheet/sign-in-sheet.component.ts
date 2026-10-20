import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../core/auth/auth.service';
import { openPolicySheet } from '../../../shared/policy/open-policy-sheet';

interface SignInSheetData {
  email: string;
}

/** Opens the sign-in sheet, with the email field filled in if given. */
export function openSignInSheet(bottomSheet: MatBottomSheet, email = '') {
  bottomSheet.open<SignInSheetComponent, SignInSheetData>(SignInSheetComponent, {
    panelClass: 'kt-bottom-sheet',
    // Not the email field: focusing it while the sheet is still sliding in opens the phone
    // keyboard over the sheet, hiding the field. Tapping it scrolls it into view instead.
    autoFocus: 'dialog',
    data: { email },
  });
}

@Component({
  selector: 'app-sign-in-sheet',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './sign-in-sheet.component.html',
  styleUrl: './sign-in-sheet.component.scss',
})
export class SignInSheetComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly bottomSheet = inject(MatBottomSheet);
  private readonly data = inject<SignInSheetData | null>(MAT_BOTTOM_SHEET_DATA, { optional: true });

  readonly form = this.fb.group({
    email: [this.data?.email ?? '', [Validators.required, Validators.email]],
  });

  readonly submitting = signal(false);
  readonly sent = signal(false);
  readonly errorMessage = signal<string | null>(null);

  async submit() {
    if (this.form.invalid) return;
    this.submitting.set(true);
    this.errorMessage.set(null);

    const { email } = this.form.getRawValue();
    try {
      // Sends a link to any address (creating the account if there is none), so the answer
      // never says whether the address is already registered.
      await this.auth.requestMagicLink(email!);
      this.sent.set(true);
    } catch {
      this.errorMessage.set('Something went wrong. Please try again in a minute.');
    } finally {
      this.submitting.set(false);
    }
  }

  /**
   * Only one bottom sheet can be open at a time, so the policy replaces this sheet, and this one
   * comes back when it's closed, with the email still filled in.
   */
  async openPrivacyPolicy(event: Event) {
    event.preventDefault();
    const email = this.form.controls.email.value ?? '';
    const policySheet = await openPolicySheet(this.bottomSheet, 'privacy');
    policySheet.afterDismissed().subscribe(() => openSignInSheet(this.bottomSheet, email));
  }
}
