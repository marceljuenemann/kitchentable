import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { lookingForLabel } from '../../onboarding/onboarding-options';
import { Conversation, introText } from '../messages/messages.model';

/** Two chips fit on a line: beyond that, the first and how many more are on the profile. */
export function chipLabels(labels: string[]): string[] {
  return labels.length > 2 ? [labels[0], `+${labels.length - 1} more`] : labels;
}

/**
 * A connection request as a teaser: their photo and the start of the introduction, all of it one
 * link to the profile, where the rest is.
 */
@Component({
  selector: 'app-request-tile',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './request-tile.component.html',
  styleUrl: './request-tile.component.scss',
})
export class RequestTileComponent {
  readonly conversation = input.required<Conversation>();
  readonly transitionName = input('none');
  /** Before the navigation, so the browser captures this photo as the morph's start. */
  readonly opening = output();

  readonly text = computed(() => introText(this.conversation()));
  readonly chips = computed(() => chipLabels(this.conversation().lookingFor.map(lookingForLabel)));
}
