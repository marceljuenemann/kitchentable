import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../core/auth/auth.service';

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

  readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
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
}
