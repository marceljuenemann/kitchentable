import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { AuthService } from '../../../core/auth/auth.service';
import { injectSignOut } from '../../../core/auth/sign-out';
import { LegalLinksComponent } from '../../../shared/legal-links/legal-links.component';
import { UnderConstructionComponent } from '../under-construction.component';

/**
 * The "Your profile" tab. Editing the profile isn't built yet, but the account part is: signing
 * out, and the legal documents (also on the Community tab).
 */
@Component({
  selector: 'app-profile-tab',
  standalone: true,
  imports: [LegalLinksComponent, MatButtonModule, MatCardModule, UnderConstructionComponent],
  templateUrl: './profile-tab.component.html',
  styleUrl: './profile-tab.component.scss',
})
export class ProfileTabComponent {
  readonly session = inject(AuthService).session;
  readonly signOut = injectSignOut();
}
