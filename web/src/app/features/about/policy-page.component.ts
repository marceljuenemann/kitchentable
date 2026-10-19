import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FooterComponent } from '../../shared/footer/footer.component';
import { HeaderComponent } from '../../shared/header/header.component';
import { PolicyComponent, PolicyId } from '../../shared/policy/policy.component';

/** A legal document on its own page; the route's `data.policy` picks which. */
@Component({
  selector: 'app-policy-page',
  standalone: true,
  imports: [FooterComponent, HeaderComponent, PolicyComponent],
  templateUrl: './policy-page.component.html',
  styleUrl: './policy-page.component.scss',
})
export class PolicyPageComponent {
  readonly policy: PolicyId = inject(ActivatedRoute).snapshot.data['policy'];
}
