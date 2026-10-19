import { Component, ViewEncapsulation, computed, input } from '@angular/core';
import { marked } from 'marked';
import privacyPolicy from '../../../../../docs/policies/privacy-policy.md';
import termsOfUse from '../../../../../docs/policies/terms-of-use.md';

/** The legal documents in docs/policies, bundled as Markdown at build time. */
const POLICIES = {
  terms: termsOfUse,
  privacy: privacyPolicy,
};

export type PolicyId = keyof typeof POLICIES;

/**
 * A legal document rendered from its Markdown source, without any page layout, so it can be
 * shown on its own page or in a sheet. Angular sanitizes the HTML, and the content is ours.
 */
@Component({
  selector: 'app-policy',
  standalone: true,
  template: '',
  host: { '[innerHTML]': 'html()' },
  styleUrl: './policy.component.scss',
  // The rendered HTML isn't part of the template, so encapsulated styles wouldn't reach it.
  // The stylesheet is scoped to `app-policy` instead.
  encapsulation: ViewEncapsulation.None,
})
export class PolicyComponent {
  readonly policy = input.required<PolicyId>();

  readonly html = computed(() => marked.parse(POLICIES[this.policy()], { async: false }));
}
