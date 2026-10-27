import { Component } from '@angular/core';
import { HeaderComponent } from '../../../shared/header/header.component';

/** Placeholder: the list of applications waiting for review is not built yet. */
@Component({
  selector: 'app-vetting',
  standalone: true,
  imports: [HeaderComponent],
  template: `
    <app-header />
    <h1>Hello World</h1>
  `,
})
export class VettingComponent {}
