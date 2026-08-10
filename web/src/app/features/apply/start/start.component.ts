import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-start',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './start.component.html',
  styleUrl: './start.component.scss',
})
export class StartComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    inviteCode: ['', Validators.required],
  });

  readonly submitting = signal(false);
  readonly sent = signal(false);
  readonly errorMessage = signal<string | null>(null);

  async submit() {
    if (this.form.invalid) return;
    this.submitting.set(true);
    this.errorMessage.set(null);

    const { email, inviteCode } = this.form.getRawValue();
    try {
      await this.auth.requestMagicLink(email!, inviteCode!);
      this.sent.set(true);
    } catch (err) {
      this.errorMessage.set(
        err instanceof Error ? err.message : 'Something went wrong, please try again.',
      );
    } finally {
      this.submitting.set(false);
    }
  }
}
