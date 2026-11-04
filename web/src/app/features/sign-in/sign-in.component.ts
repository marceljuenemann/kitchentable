import { Component, ElementRef, afterNextRender, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { safeNext } from '../../core/auth/next-url';
import { FooterComponent } from '../../shared/footer/footer.component';
import { HeaderComponent } from '../../shared/header/header.component';
import { openPolicySheet } from '../../shared/policy/open-policy-sheet';

/**
 * `/sign-in`: asks for an email address and sends a sign-in link to it. Linked from the landing
 * page, and where signed-out visitors to a signed-in page go (`?next=`, a link in an email opened
 * on another device, say): the sign-in link then leads back to that page.
 */
@Component({
  selector: 'app-sign-in',
  standalone: true,
  imports: [
    FooterComponent,
    HeaderComponent,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    ReactiveFormsModule,
  ],
  templateUrl: './sign-in.component.html',
  styleUrl: './sign-in.component.scss',
})
export class SignInComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly bottomSheet = inject(MatBottomSheet);

  private readonly next = safeNext(inject(ActivatedRoute).snapshot.queryParamMap.get('next'));

  readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  readonly submitting = signal(false);
  readonly sent = signal(false);
  readonly errorMessage = signal<string | null>(null);

  private readonly emailInput = viewChild<ElementRef<HTMLInputElement>>('emailInput');

  constructor() {
    // The field is all there is to do here. Unlike in a sheet, the phone keyboard can't cover it
    // (and iOS doesn't open the keyboard for it anyway, without a tap).
    afterNextRender(() => this.emailInput()?.nativeElement.focus());
  }

  async submit() {
    if (this.form.invalid) return;
    this.submitting.set(true);
    this.errorMessage.set(null);

    const { email } = this.form.getRawValue();
    try {
      // Sends a link to any address (creating the account if there is none), so the answer
      // never says whether the address is already registered.
      await this.auth.requestMagicLink(email!, { next: this.next });
      this.sent.set(true);
    } catch {
      this.errorMessage.set('Something went wrong. Please try again in a minute.');
    } finally {
      this.submitting.set(false);
    }
  }

  openPrivacyPolicy(event: Event) {
    event.preventDefault();
    void openPolicySheet(this.bottomSheet, 'privacy');
  }
}
