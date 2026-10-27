import { Location } from '@angular/common';
import { Component, computed, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter, firstValueFrom } from 'rxjs';
import { Profile } from '../../core/profile.model';
import { ageFrom } from '../../core/age';
import { lookingForLabel } from '../../features/onboarding/onboarding-options';
import { photoTransitionName } from './profile-transition';

/**
 * A profile as members see it (prototype/browse): a full-width photo carousel, then name and
 * age, pronouns and location, gender and sexuality chips, the About me text and Looking for. Covers the
 * screen over the grid it was opened from, as the child route of that grid. Anything placed
 * inside it (say, the admin's vetting box) goes below the profile.
 */
@Component({
  selector: 'app-profile-view',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './profile-view.component.html',
  styleUrl: './profile-view.component.scss',
})
export class ProfileViewComponent {
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly route = inject(ActivatedRoute);

  readonly profile = input.required<Profile>();
  /** URLs for `profile.photos`, in the same order; null for one not (yet) available. */
  readonly photoUrls = input<(string | null)[]>([]);
  /** The back button's accessible name, e.g. "Back to applications". */
  readonly backLabel = input('Back');

  private readonly track = viewChild<ElementRef<HTMLElement>>('track');
  /** The photo the carousel shows. */
  readonly photoIndex = signal(0);

  readonly transitionName = computed(() => photoTransitionName(this.profile().id));
  readonly age = computed(() => {
    const { birth_month, birth_year } = this.profile();
    return ageFrom(`${birth_month ?? ''}`, `${birth_year ?? ''}`);
  });
  readonly heading = computed(() => {
    const age = this.age();
    return age === null ? this.profile().name : `${this.profile().name}, ${age}`;
  });
  readonly aboutParagraphs = computed(() =>
    this.profile()
      .bio.split(/\n\s*\n/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean),
  );
  readonly lookingFor = computed(() => this.profile().looking_for.map(lookingForLabel));

  onTrackScroll() {
    const track = this.track()?.nativeElement;
    if (track) this.photoIndex.set(Math.round(track.scrollLeft / track.clientWidth));
  }

  showPhoto(index: number) {
    const track = this.track()?.nativeElement;
    track?.scrollTo({ left: index * track.clientWidth, behavior: 'smooth' });
  }

  /**
   * Back to the grid: through the browser history when we came from it, so the phone's back
   * gesture and this button agree, or to the parent route when the profile was opened directly.
   * Resolves once the grid shows.
   */
  async close(): Promise<void> {
    if (this.router.lastSuccessfulNavigation()?.previousNavigation) {
      const done = firstValueFrom(
        this.router.events.pipe(filter((event) => event instanceof NavigationEnd)),
      );
      this.location.back();
      await done;
    } else {
      await this.router.navigate(['..'], { relativeTo: this.route });
    }
  }
}
