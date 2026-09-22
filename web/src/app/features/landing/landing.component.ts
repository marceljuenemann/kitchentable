import { Component, computed, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { LogoComponent } from '../../shared/logo/logo.component';

const EMAIL_PATTERN = /\S+@\S+\.\S+/;

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [
    LogoComponent,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
  ],
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

  setAgree(checked: boolean) {
    this.agree.set(checked);
  }
}
