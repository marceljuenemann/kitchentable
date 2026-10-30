import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { FooterComponent } from '../../../shared/footer/footer.component';
import { HeaderComponent } from '../../../shared/header/header.component';
import { InviteLinkComponent } from '../../../shared/invite-link/invite-link.component';

/**
 * Shown once onboarding is submitted, while the profile is in `vetting` status, with the user's
 * own invite link to pass on.
 */
@Component({
  selector: 'app-submitted',
  standalone: true,
  imports: [MatCardModule, MatIconModule, FooterComponent, HeaderComponent, InviteLinkComponent],
  templateUrl: './submitted.component.html',
  styleUrl: './submitted.component.scss',
})
export class SubmittedComponent {}
