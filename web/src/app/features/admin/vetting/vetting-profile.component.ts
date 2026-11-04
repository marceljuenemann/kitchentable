import { Component, computed, DestroyRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { injectProfilePhotoUrls } from '../../../shared/profile-view/profile-photo-urls';
import { CLOSE_ANIMATION_MS } from '../../../shared/profile-view/profile-transition';
import { ProfileViewComponent } from '../../../shared/profile-view/profile-view.component';
import { VettingBoxComponent } from './vetting-box.component';
import { VettingStore } from './vetting.store';

/** One application over the grid: the profile as members will see it, and the vetting box. */
@Component({
  selector: 'app-vetting-profile',
  standalone: true,
  imports: [MatButtonModule, RouterLink, ProfileViewComponent, VettingBoxComponent],
  templateUrl: './vetting-profile.component.html',
  styleUrl: './vetting-profile.component.scss',
})
export class VettingProfileComponent {
  private readonly store = inject(VettingStore);
  private readonly route = inject(ActivatedRoute);

  private readonly view = viewChild(ProfileViewComponent);
  private readonly id = toSignal(this.route.paramMap.pipe(map((params) => params.get('id'))), {
    initialValue: this.route.snapshot.paramMap.get('id'),
  });
  /** Undefined while the list loads, null if it isn't (or no longer) waiting for review. */
  readonly application = computed(() => {
    const applications = this.store.applications();
    if (applications === null) return undefined;
    return applications.find((application) => application.id === this.id()) ?? null;
  });
  readonly photoUrls = injectProfilePhotoUrls(this.application, () => {
    const application = this.application();
    return (application && this.store.thumbs().get(application.id)) ?? null;
  });
  readonly approving = signal(false);
  readonly approveFailed = signal(false);

  constructor() {
    // Set during the navigation (not in an effect), so the tile gives up the morph's name
    // before the browser captures the new page.
    this.route.paramMap
      .pipe(takeUntilDestroyed())
      .subscribe((params) => this.store.openId.set(params.get('id')));
    inject(DestroyRef).onDestroy(() => this.store.openId.set(null));
  }

  async approve() {
    const application = this.application();
    if (!application) return;
    this.approving.set(true);
    this.approveFailed.set(false);
    try {
      await this.store.approve(application.id);
    } catch {
      this.approveFailed.set(true);
      this.approving.set(false);
      return;
    }
    // Back to the grid first, so the photo morphs back into its tile, then the tile goes.
    await this.view()?.close();
    setTimeout(() => this.store.remove(application.id), CLOSE_ANIMATION_MS);
  }
}
