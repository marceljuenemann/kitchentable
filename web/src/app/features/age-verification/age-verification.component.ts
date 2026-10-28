import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, Router } from '@angular/router';
import { concatMap, first, take, timer } from 'rxjs';
import { ProfileService } from '../../core/profile.service';
import { FooterComponent } from '../../shared/footer/footer.component';
import { HeaderComponent } from '../../shared/header/header.component';
import { openPolicySheet } from '../../shared/policy/open-policy-sheet';

/** After a passed check, how often and how many times to look for the webhook's activation. */
export const POLL_INTERVAL_MS = 2000;
export const POLL_ATTEMPTS = 15;

/**
 * - `start`: explains the check, with a button to start it
 * - `declined`: back from Didit after a failed check, to try again
 * - `finishing`: back from Didit after a passed check, until the webhook activates the profile
 * - `slow`: the activation is taking longer than usual
 * - `review`: back from Didit with a check that needs a manual review
 */
export type AgeVerificationPhase = 'start' | 'declined' | 'finishing' | 'slow' | 'review';

/** Didit's `status` on the way back. Only a hint for what to show: the webhook decides. */
const PHASE_FOR_STATUS: Record<string, AgeVerificationPhase> = {
  Approved: 'finishing',
  Declined: 'declined',
  'In Review': 'review',
};

/**
 * Shown to approved applicants until Didit has confirmed they're 18 or over (see "Age
 * verification" in docs/database.md). The check happens on Didit's page, which sends the user
 * back to `/app` with its `status`.
 */
@Component({
  selector: 'app-age-verification',
  standalone: true,
  imports: [
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    FooterComponent,
    HeaderComponent,
  ],
  templateUrl: './age-verification.component.html',
  styleUrl: './age-verification.component.scss',
})
export class AgeVerificationComponent {
  private readonly profiles = inject(ProfileService);
  private readonly bottomSheet = inject(MatBottomSheet);
  private readonly destroyRef = inject(DestroyRef);

  readonly phase = signal<AgeVerificationPhase>('start');
  readonly starting = signal(false);
  readonly failed = signal(false);

  constructor() {
    const route = inject(ActivatedRoute);
    const status = route.snapshot.queryParamMap.get('status');
    if (status === null) return;

    // Drop Didit's parameters, so that neither a reload nor the main app sees them again.
    void inject(Router).navigate([], { relativeTo: route, queryParams: {}, replaceUrl: true });
    const phase = PHASE_FOR_STATUS[status] ?? 'start';
    if (phase === 'finishing') this.waitForActivation();
    else this.phase.set(phase);
  }

  async start() {
    this.starting.set(true);
    this.failed.set(false);
    try {
      // The button stays disabled while the browser leaves for Didit.
      window.location.assign(await this.profiles.startAgeVerification());
    } catch {
      this.failed.set(true);
      this.starting.set(false);
    }
  }

  /**
   * Didit usually calls the webhook within seconds. Once the profile is active, a refresh makes
   * the shell show the main app.
   */
  waitForActivation() {
    this.phase.set('finishing');
    timer(POLL_INTERVAL_MS, POLL_INTERVAL_MS)
      .pipe(
        take(POLL_ATTEMPTS),
        // A failed poll is just no news yet.
        concatMap(() => this.profiles.fetchStatus().catch(() => 'approved' as const)),
        first((status) => status !== 'approved', 'approved' as const),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((status) =>
        status === 'approved' ? this.phase.set('slow') : this.profiles.refresh(),
      );
  }

  openPrivacyPolicy(event: Event) {
    event.preventDefault();
    void openPolicySheet(this.bottomSheet, 'privacy');
  }
}
