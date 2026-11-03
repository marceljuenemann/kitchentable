import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConnectionsStore } from '../../../core/connections/connections.store';
import { ConversationRowComponent } from './conversation-row.component';

/**
 * The Messages tab: everyone you're talking to, the team included, by latest message. A
 * conversation or profile opens over this list as its child route, so the list keeps its scroll
 * position.
 */
@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [ConversationRowComponent, RouterOutlet],
  templateUrl: './messages.component.html',
  styleUrl: './messages.component.scss',
  host: { '[class.covering]': 'overlayOpen()' },
})
export class MessagesComponent {
  readonly store = inject(ConnectionsStore);
  /** Whether a conversation or profile shows over the list, which raises it over the bottom nav. */
  readonly overlayOpen = signal(false);
  /**
   * The one row whose photo morphs: the last one tapped. Every other row stays part of the page,
   * or its photo would float above the profile during the animation (see ProfileGridComponent).
   * It gives up the name while anything shows over the list, since names must be unique.
   */
  readonly morphId = signal<string | null>(null);
}
