import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../../core/auth/auth.service';
import { UserStorage } from '../../core/user-storage';

/** Contact/legal links, plus "Signed in as … Sign out" when there is a session. */
@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [MatButtonModule],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss',
})
export class FooterComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly userStorage = inject(UserStorage);

  readonly session = this.auth.session;

  async signOut() {
    this.userStorage.onSignOut();
    await this.auth.signOut();
    await this.router.navigateByUrl('/');
  }
}
