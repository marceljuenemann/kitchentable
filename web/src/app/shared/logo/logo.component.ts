import { Component, input } from '@angular/core';

@Component({
  selector: 'app-logo',
  standalone: true,
  template: `<img src="/logo.svg" alt="" [style.width.px]="size()" [style.height.px]="size()" />`,
})
export class LogoComponent {
  readonly size = input(48);
}
