import { Component } from '@angular/core';

/** Placeholder: shown while the profile is being vetted. */
@Component({
  selector: 'app-vetting',
  standalone: true,
  template: `
    <h1>Thanks for applying</h1>
    <p>We're reviewing your application and will email you once we've made a decision.</p>
  `,
})
export class VettingComponent {}
