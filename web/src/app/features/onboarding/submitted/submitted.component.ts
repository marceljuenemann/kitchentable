import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { FooterComponent } from '../../../shared/footer/footer.component';
import { HeaderComponent } from '../../../shared/header/header.component';

/** Shown once onboarding is submitted, while the profile is in `vetting` status. */
@Component({
  selector: 'app-submitted',
  standalone: true,
  imports: [MatIconModule, FooterComponent, HeaderComponent],
  templateUrl: './submitted.component.html',
  styleUrl: './submitted.component.scss',
})
export class SubmittedComponent {}
