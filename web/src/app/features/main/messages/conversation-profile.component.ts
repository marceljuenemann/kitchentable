import { Component, computed, inject, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { ActivatedRoute, Router } from '@angular/router';
import { ConnectionsStore } from '../../../core/connections/connections.store';
import { ProfileViewComponent } from '../../../shared/profile-view/profile-view.component';

/**
 * The profile of someone you're talking to, over the conversation or over the list. From the list
 * it's a route of its own, so that looking at a photo doesn't open the conversation and mark it
 * read.
 */
@Component({
  selector: 'app-conversation-profile',
  standalone: true,
  imports: [MatButtonModule, ProfileViewComponent],
  template: `
    @if (conversation(); as conversation) {
      <app-profile-view
        [profile]="conversation.person"
        [photoUrls]="[conversation.photoUrl]"
        [backLabel]="overConversation ? 'Back to conversation' : 'Back to messages'"
      >
        <div class="kt-profile-actions">
          <div class="kt-profile-bar">
            <button mat-flat-button type="button" (click)="openConversation()">
              {{ actionLabel() }}
            </button>
          </div>
        </div>
      </app-profile-view>
    }
  `,
  styles: `
    button {
      --mat-button-filled-container-height: 52px;
      --mat-button-filled-label-text-size: 16.5px;
    }
  `,
})
export class ConversationProfileComponent {
  private readonly store = inject(ConnectionsStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly view = viewChild(ProfileViewComponent);
  private readonly conversationId = this.route.parent?.snapshot.paramMap.get('id') ?? null;
  private readonly id = this.conversationId ?? this.route.snapshot.paramMap.get('id');

  /** Whether it shows over the conversation, rather than the list. */
  readonly overConversation = this.conversationId !== null;
  readonly conversation = computed(() => this.store.conversation(this.id));
  /** An ended conversation can only be read. */
  readonly actionLabel = computed(() => {
    const conversation = this.conversation();
    return conversation?.status === 'accepted'
      ? `Message ${conversation.person.name}`
      : 'View messages';
  });

  /**
   * From the list, replaces the profile in the history, so back from the conversation goes to the
   * list. Not if the profile was opened by its URL: there may be nothing to go back to then.
   */
  openConversation() {
    if (this.overConversation) {
      this.view()?.close();
    } else {
      const replaceUrl = !!this.router.lastSuccessfulNavigation()?.previousNavigation;
      this.router.navigate(['/app/messages', this.id], { replaceUrl });
    }
  }
}
