import { Component } from '@angular/core';
import { FooterComponent } from '../../shared/footer/footer.component';
import { HeaderComponent } from '../../shared/header/header.component';

/** Placeholder: shown while the profile is being vetted. */
@Component({
  selector: 'app-vetting',
  standalone: true,
  imports: [FooterComponent, HeaderComponent],
  template: `
    <app-header />
    <h1>Thanks for applying</h1>
    <p>We're reviewing your application and will email you once we've made a decision.</p>
    <app-footer />
  `,
})
export class VettingComponent {}
