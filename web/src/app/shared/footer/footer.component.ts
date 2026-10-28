import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../../core/auth/auth.service';
import { injectSignOut } from '../../core/auth/sign-out';

/** Contact/legal links, plus "Signed in as … Sign out" when there is a session. */
@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [MatButtonModule, RouterLink],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss',
})
export class FooterComponent {
  readonly session = inject(AuthService).session;
  readonly signOut = injectSignOut();
}
