import { Component, computed, input } from '@angular/core';
import { HeartComponent } from '../../../shared/heart/heart.component';
import { lookingForLabel } from '../../../core/profile-options';
import { shortDate } from './message-time';

/**
 * An introduction: what someone wrote and what they want to connect on. The same card on the
 * profile of someone who sent it and at the top of the conversation that may follow.
 */
@Component({
  selector: 'app-intro-card',
  standalone: true,
  imports: [HeartComponent],
  template: `
    <p class="title">
      <app-heart [size]="16" />
      <span>{{ title() }}</span>
      <time>{{ formattedDate() }}</time>
    </p>
    <!-- A binding, because the text keeps whitespace, also any around an interpolation. -->
    <p class="text" [textContent]="text()"></p>
    @if (labels().length > 0) {
      <p class="label">{{ mine() ? 'You want to connect on' : 'Wants to connect on' }}</p>
      <ul>
        @for (label of labels(); track label) {
          <li>{{ label }}</li>
        }
      </ul>
    }
  `,
  styles: `
    :host {
      display: block;
      padding: 14px 16px 16px;
      border: 1px solid var(--kt-cream-strong);
      border-radius: 20px;
      background: var(--kt-cream);
    }

    p {
      margin: 0;
    }

    .title {
      display: flex;
      align-items: baseline;
      gap: 6px;
      font-family: var(--kt-font-display);
      font-size: 16px;
      font-weight: 700;
      color: var(--kt-violet);

      // Moved up to the middle of the capitals, which sit high in the display font's line.
      app-heart {
        align-self: center;
        transform: translateY(-1.5px);
      }

      time {
        flex: none;
        margin-left: auto;
        font-family: var(--kt-font-sans);
        font-size: 12.5px;
        font-weight: 400;
        color: var(--kt-muted);
      }
    }

    .text {
      margin-top: 8px;
      font-size: 15.5px;
      line-height: 1.5;
      overflow-wrap: anywhere;
      white-space: pre-wrap;
    }

    .label {
      margin-top: 14px;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--kt-muted);
    }

    ul {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin: 6px 0 0;
      padding: 0;
      list-style: none;
    }

    // Dark, because Looking for's light violet clashes with the gold of the card.
    li {
      padding: 8px 13px;
      border-radius: 99px;
      background: var(--kt-violet);
      font-size: 13.5px;
      font-weight: 700;
      color: var(--kt-raised);
    }
  `,
})
export class IntroCardComponent {
  readonly title = input.required<string>();
  /** When it was sent. */
  readonly date = input.required<string>();
  readonly text = input.required<string>();
  /** As stored: `connections.looking_for`. */
  readonly lookingFor = input<string[]>([]);
  /** Whether the viewer wrote it. */
  readonly mine = input(false);

  readonly formattedDate = computed(() => shortDate(this.date()));
  readonly labels = computed(() => this.lookingFor().map(lookingForLabel));
}
