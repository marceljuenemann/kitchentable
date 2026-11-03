import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  Conversation,
  lastMessage,
  previewOf,
  unreadCount,
} from '../../../core/connections/connections.model';
import { photoTransitionName } from '../../../shared/profile-view/profile-transition';
import { AvatarComponent } from './avatar.component';
import { listTime } from './message-time';

/** One conversation in the Messages tab: the photo opens the profile, the rest the messages. */
@Component({
  selector: 'app-conversation-row',
  standalone: true,
  imports: [AvatarComponent, RouterLink],
  templateUrl: './conversation-row.component.html',
  styleUrl: './conversation-row.component.scss',
})
export class ConversationRowComponent {
  readonly conversation = input.required<Conversation>();
  /** Whether this row's photo takes part in the morph to and from the profile. */
  readonly morphs = input(false);
  /** Before the navigation, so the browser captures this row's photo as the morph's start. */
  readonly openingProfile = output();

  readonly conversationLink = computed(() => ['/app/messages', this.conversation().person.id]);
  readonly transitionName = computed(() =>
    this.morphs() ? photoTransitionName(this.conversation().person.id) : null,
  );
  readonly preview = computed(() => previewOf(this.conversation()));
  readonly unread = computed(() => unreadCount(this.conversation()));
  readonly time = computed(() => {
    const message = lastMessage(this.conversation());
    return message ? listTime(message.createdAt) : '';
  });
}
