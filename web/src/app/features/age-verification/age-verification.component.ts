import { Component } from '@angular/core';
import { FooterComponent } from '../../shared/footer/footer.component';
import { HeaderComponent } from '../../shared/header/header.component';

/** Placeholder: automated age verification is not built yet. */
@Component({
  selector: 'app-age-verification',
  standalone: true,
  imports: [FooterComponent, HeaderComponent],
  template: `
    <app-header />
    <h1>You're approved!</h1>
    <p>One last step: we need to verify your age before your profile goes live.</p>
    <app-footer />
  `,
})
export class AgeVerificationComponent {}
