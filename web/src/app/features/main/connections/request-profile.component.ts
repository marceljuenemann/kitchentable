import { Component, inject, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { introText } from '../../../core/connections/connections.model';
import { ConnectionsStore } from '../../../core/connections/connections.store';
import { HeartComponent } from '../../../shared/heart/heart.component';
import { HideIconComponent } from '../../../shared/hide-icon/hide-icon.component';
import { CLOSE_ANIMATION_MS } from '../../../shared/profile-view/profile-transition';
import { ProfileViewComponent } from '../../../shared/profile-view/profile-view.component';
import { IntroCardComponent } from '../messages/intro-card.component';
import { injectRequestActions } from './request-actions';

/** The profile of someone who sent a connection request, over the cards: where to accept it. */
@Component({
  selector: 'app-request-profile',
  standalone: true,
  imports: [
    HeartComponent,
    HideIconComponent,
    IntroCardComponent,
    MatButtonModule,
    ProfileViewComponent,
    RouterLink,
  ],
  template: `
    @if (conversation; as conversation) {
      <app-profile-view
        [profile]="conversation.person"
        [photoUrls]="[conversation.photoUrl]"
        backLabel="Back to introductions"
      >
        <div class="intro" profileIntro>
          <app-intro-card
            [title]="conversation.person.name + '’s introduction'"
            [date]="conversation.messages[0].createdAt"
            [text]="introText(conversation)"
            [lookingFor]="conversation.lookingFor"
          />
        </div>
        <div class="kt-profile-actions">
          <div class="kt-profile-bar">
            <button class="hide" mat-stroked-button type="button" (click)="hide()">
              <span class="label">
                <app-hide-icon />
                Hide profile
              </span>
            </button>
            <button mat-flat-button type="button" (click)="accept()">
              <span class="label">
                <app-heart />
                Connect
              </span>
            </button>
          </div>
        </div>
      </app-profile-view>
    } @else {
      <div class="gone">
        <p>This introduction isn't available.</p>
        <a mat-flat-button routerLink="/app/connections">Back to introductions</a>
      </div>
    }
  `,
  styles: `
    // Above About me, what's most relevant here. Fades in with the rest of the profile.
    .intro {
      margin-top: 20px;
      animation: kt-fade-in 0.2s 0.22s ease-out both;

      @media (prefers-reduced-motion: reduce) {
        animation: none;
      }
    }

    .label {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    // Slim side padding, so "Hide profile" fits on a 360px phone.
    button {
      --mat-button-filled-container-height: 52px;
      --mat-button-filled-label-text-size: 16.5px;
      --mat-button-filled-horizontal-padding: 12px;
      --mat-button-outlined-container-height: 52px;
      --mat-button-outlined-label-text-size: 16.5px;
      --mat-button-outlined-horizontal-padding: 12px;
    }

    .hide {
      --mat-button-outlined-outline-color: var(--kt-outline-soft);
      --mat-button-outlined-label-text-color: var(--kt-violet);
      background: var(--kt-raised);
    }

    // Like the profile view: covers the cards.
    .gone {
      position: fixed;
      inset: 0;
      z-index: 20;
      padding: 64px 24px;
      background: var(--kt-bg);
      text-align: center;

      p {
        margin: 0 0 20px;
        font-size: 16px;
      }
    }
  `,
})
export class RequestProfileComponent {
  private readonly store = inject(ConnectionsStore);
  private readonly router = inject(Router);
  private readonly actions = injectRequestActions();
  private readonly view = viewChild(ProfileViewComponent);
  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id');

  /** Not reactive: it has to stay while the page leaves, after accepting or hiding. */
  readonly conversation = this.store.requests().find(({ person }) => person.id === this.id);
  readonly introText = introText;

  /** Replaces the profile in the history, so back from the conversation goes to the cards. */
  accept() {
    const replaceUrl = !!this.router.lastSuccessfulNavigation()?.previousNavigation;
    if (this.conversation) this.actions.accept(this.conversation, { replaceUrl });
  }

  /** Back to the cards first, so the photo morphs back into its card, then the card goes. */
  async hide() {
    await this.view()?.close();
    const conversation = this.conversation;
    if (conversation) setTimeout(() => this.actions.hide(conversation), CLOSE_ANIMATION_MS);
  }
}
