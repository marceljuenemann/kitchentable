import { Clipboard } from '@angular/cdk/clipboard';
import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { filter, map, switchMap } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { inviteCodeFor } from '../../core/invite-code';

const SHARE_TEXT =
  'Join me on Kitchen Table, the new non-profit dating community for ENM folks in London';

/**
 * The signed-in user's own invite link, with buttons to share it (where the system has a share
 * sheet, mostly phones) and copy it. The text around it is up to the screen. The link's box is
 * `--kt-sunken` unless `--invite-link-background` says otherwise.
 */
@Component({
  selector: 'app-invite-link',
  standalone: true,
  imports: [MatButtonModule],
  template: `
    @if (inviteLink(); as link) {
      <p class="link">{{ link }}</p>
      @if (canShare) {
        <button mat-flat-button type="button" (click)="share()">Share invite link</button>
        <button mat-button type="button" (click)="copy()">
          {{ copied() ? 'Link copied' : 'Copy link' }}
        </button>
      } @else {
        <button mat-flat-button type="button" (click)="copy()">
          {{ copied() ? 'Link copied' : 'Copy link' }}
        </button>
      }
    }
  `,
  styles: `
    :host {
      display: block;
    }

    // Through :host, to win over the paragraph styles of a .kt-card around it.
    :host .link {
      margin: 0 0 16px;
      padding: 12px 14px;
      border-radius: 14px;
      background: var(--invite-link-background, var(--kt-sunken));
      font-size: 14.5px;
      line-height: 1.5;
      color: var(--kt-ink);
      overflow-wrap: anywhere;
      // A tap selects the whole link, for copying by hand.
      user-select: all;
    }

    button {
      width: 100%;

      & + button {
        margin-top: 8px;
      }
    }
  `,
})
export class InviteLinkComponent {
  private readonly clipboard = inject(Clipboard);

  readonly inviteLink = toSignal(
    inject(AuthService).userId$.pipe(
      filter((userId) => userId !== null),
      switchMap((userId) => inviteCodeFor(userId)),
      map((code) => `${window.location.origin}/?invite=${code}`),
    ),
  );
  readonly canShare = typeof navigator.share === 'function';
  readonly copied = signal(false);

  copy() {
    const link = this.inviteLink();
    if (link) this.copied.set(this.clipboard.copy(link));
  }

  async share() {
    const link = this.inviteLink();
    if (!link) return;
    try {
      await navigator.share({ text: SHARE_TEXT, url: link });
    } catch {
      // Closing the share sheet without sharing rejects too; nothing to do either way.
    }
  }
}
