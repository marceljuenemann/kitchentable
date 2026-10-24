import { Clipboard } from '@angular/cdk/clipboard';
import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { filter, map, switchMap } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { inviteCodeFor } from '../../../core/invite-code';
import { FooterComponent } from '../../../shared/footer/footer.component';
import { HeaderComponent } from '../../../shared/header/header.component';

const SHARE_TEXT =
  'Join me on Kitchen Table, the new non-profit dating community for ENM folks in London';

/**
 * Shown once onboarding is submitted, while the profile is in `vetting` status, with the user's
 * own invite link to pass on.
 */
@Component({
  selector: 'app-submitted',
  standalone: true,
  imports: [MatButtonModule, MatCardModule, MatIconModule, FooterComponent, HeaderComponent],
  templateUrl: './submitted.component.html',
  styleUrl: './submitted.component.scss',
})
export class SubmittedComponent {
  private readonly clipboard = inject(Clipboard);

  readonly inviteLink = toSignal(
    inject(AuthService).userId$.pipe(
      filter((userId) => userId !== null),
      switchMap((userId) => inviteCodeFor(userId)),
      map((code) => `${window.location.origin}/?invite=${code}`),
    ),
  );
  /** The system share sheet, where there is one (mostly phones). */
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
