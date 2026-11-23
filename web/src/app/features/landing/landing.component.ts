import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FooterComponent } from '../../shared/footer/footer.component';
import { HeartComponent } from '../../shared/heart/heart.component';
import { LogoComponent } from '../../shared/logo/logo.component';
import { AuthService } from '../../core/auth/auth.service';
import { openPolicySheet } from '../../shared/policy/open-policy-sheet';

const EMAIL_PATTERN = /\S+@\S+\.\S+/;

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [
    FooterComponent,
    HeartComponent,
    LogoComponent,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    RouterLink,
  ],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
})
export class LandingComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly bottomSheet = inject(MatBottomSheet);

  readonly inviteCode = this.route.snapshot.queryParamMap.get('invite');

  /**
   * Signed-in users see the page too (the route has no guard), with a way into the app in place
   * of signing up or in. The sign-up card waits until the session is known, so it doesn't flash
   * the form first. It also follows sign-ins in another tab, such as the emailed link.
   */
  readonly sessionKnown = this.auth.ready;
  readonly signedInEmail = computed(() => this.auth.session()?.user.email ?? null);
  readonly signedIn = computed(() => this.auth.session() !== null);

  readonly email = signal('');
  // The terms are agreed to after signing in, once the address is confirmed (TermsComponent).
  readonly canSignUp = computed(() => EMAIL_PATTERN.test(this.email()));

  readonly submitting = signal(false);
  readonly sent = signal(false);
  readonly errorMessage = signal<string | null>(null);

  /** Whether the tour video has started; until then it shows its poster and a play button. */
  readonly playing = signal(false);

  private readonly signupCard = viewChild('signupCard', { read: ElementRef });
  private readonly emailInput = viewChild<ElementRef<HTMLInputElement>>('emailInput');

  /** The closing call to action: back up to the sign-up form, ready to type. */
  goToSignUp() {
    (this.signupCard()?.nativeElement as HTMLElement | undefined)?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
    this.emailInput()?.nativeElement.focus({ preventScroll: true });
  }

  setEmail(value: string) {
    this.email.set(value);
  }

  async signUp() {
    if (!this.canSignUp() || !this.inviteCode) return;
    this.submitting.set(true);
    this.errorMessage.set(null);
    try {
      await this.auth.requestMagicLink(this.email(), { inviteCode: this.inviteCode });
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
