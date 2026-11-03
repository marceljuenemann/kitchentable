import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { RouterLink } from '@angular/router';
import { ConnectionsStore } from '../../../core/connections/connections.store';
import { HeaderComponent } from '../../../shared/header/header.component';
import { InviteLinkComponent } from '../../../shared/invite-link/invite-link.component';

/**
 * The development WhatsApp group's invite link, base64-encoded so that it can't be read or found
 * by searching the public source code for chat.whatsapp.com. Anyone can still decode it.
 */
const WHATSAPP_GROUP = 'aHR0cHM6Ly9jaGF0LndoYXRzYXBwLmNvbS9CYmhnQXhaN3lXT0xFZXE3aTdRczhT';

/** `check_message_content()` allows up to this many characters. */
const MAX_LENGTH = 2000;

export interface Mood {
  emoji: string;
  label: string;
}

export const MOODS: readonly Mood[] = [
  { emoji: '😞', label: 'Really unhappy' },
  { emoji: '🙁', label: 'Not great' },
  { emoji: '😐', label: 'Okay' },
  { emoji: '🙂', label: 'Good' },
  { emoji: '😍', label: 'Love it' },
];

/**
 * The Community tab, for now ways to reach the team, invite people and take part in building the
 * app. Feedback
 * and reports are messages in the conversation with the team, so the team can reply there;
 * admins have no such conversation, so they don't see those cards.
 */
@Component({
  selector: 'app-community',
  standalone: true,
  imports: [
    HeaderComponent,
    InviteLinkComponent,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    RouterLink,
  ],
  templateUrl: './community.component.html',
  styleUrl: './community.component.scss',
  host: { class: 'kt-scroller' },
})
export class CommunityComponent {
  private readonly store = inject(ConnectionsStore);

  readonly moods = MOODS;
  readonly maxLength = MAX_LENGTH;
  readonly whatsappLink = atob(WHATSAPP_GROUP);
  readonly team = this.store.team;
  /** The mood sent, which opens the box for more. */
  readonly mood = signal<Mood | null>(null);
  readonly more = signal('');
  readonly moreSent = signal(false);

  /** One tap sends the mood straight away; tapping another sends that too. More is optional. */
  sendMood(mood: Mood) {
    const team = this.team();
    if (!team || mood === this.mood()) return;
    this.store.send(team.person.id, `Feedback: ${mood.emoji} ${mood.label}`);
    this.mood.set(mood);
  }

  sendMore() {
    const team = this.team();
    const text = this.more().trim();
    if (!team || !text) return;
    this.store.send(team.person.id, `Feedback submitted: ${text}`);
    this.moreSent.set(true);
  }
}
