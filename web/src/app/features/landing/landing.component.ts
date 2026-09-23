import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FooterComponent } from '../../shared/footer/footer.component';
import { HeaderComponent } from '../../shared/header/header.component';
import { AuthService } from '../../core/auth/auth.service';
import { SignInSheetComponent } from './sign-in-sheet/sign-in-sheet.component';

const EMAIL_PATTERN = /\S+@\S+\.\S+/;

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [
    FooterComponent,
    HeaderComponent,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
})
export class LandingComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly bottomSheet = inject(MatBottomSheet);

  readonly inviteCode = this.route.snapshot.queryParamMap.get('invite');

  readonly email = signal('');
  readonly agree = signal(false);
  readonly canSignUp = computed(() => EMAIL_PATTERN.test(this.email()) && this.agree());

  readonly submitting = signal(false);
  readonly sent = signal(false);
  readonly errorMessage = signal<string | null>(null);

  setEmail(value: string) {
    this.email.set(value);
  }

  setAgree(checked: boolean) {
    this.agree.set(checked);
  }

  async signUp() {
    if (!this.canSignUp() || !this.inviteCode) return;
    this.submitting.set(true);
    this.errorMessage.set(null);
    try {
      await this.auth.requestMagicLink(this.email(), this.inviteCode);
      this.sent.set(true);
    } catch {
      this.errorMessage.set('Invalid invite link, could not create profile.');
    } finally {
      this.submitting.set(false);
    }
  }

  openSignIn() {
    this.bottomSheet.open(SignInSheetComponent, { panelClass: 'kt-bottom-sheet' });
  }
}
