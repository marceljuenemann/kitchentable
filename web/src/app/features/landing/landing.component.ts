import { Component, computed, signal } from '@angular/core';
import { LogoComponent } from '../../shared/logo/logo.component';

const EMAIL_PATTERN = /\S+@\S+\.\S+/;

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [LogoComponent],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
})
export class LandingComponent {
  readonly email = signal('');
  readonly agree = signal(false);

  readonly canSignUp = computed(() => EMAIL_PATTERN.test(this.email()) && this.agree());

  setEmail(value: string) {
    this.email.set(value);
  }

  toggleAgree() {
    this.agree.update((value) => !value);
  }
}
