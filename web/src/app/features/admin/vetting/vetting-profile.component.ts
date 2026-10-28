import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { PhotoStorageService } from '../../../core/photo-storage.service';
import { ProfileViewComponent } from '../../../shared/profile-view/profile-view.component';
import { VettingBoxComponent } from './vetting-box.component';
import { Application, VettingStore } from './vetting.store';

/** How long closing a profile animates (styles.scss), before its tile may go away. */
const CLOSE_ANIMATION_MS = 340;

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
  private readonly photos = inject(PhotoStorageService);
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
  /** Full-size photo URLs, once fetched for the open application. */
  private readonly fullUrls = signal<{ id: string; urls: (string | null)[] } | null>(null);
  /**
   * The cached thumbnail for the main photo until the full-size photos are signed, so the morph
   * lands on a photo straight away; the browser swaps in the full one once it has loaded.
   */
  readonly photoUrls = computed(() => {
    const application = this.application();
    if (!application) return [];
    const full = this.fullUrls();
    if (full?.id === application.id) return full.urls;
    return [this.store.thumbs().get(application.id) ?? null];
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

    // Once the application is known (the list may still be loading when opened by its URL).
    effect(() => {
      const application = this.application();
      if (application) untracked(() => this.loadFullPhotos(application));
    });
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

  private async loadFullPhotos({ id, photos }: Application) {
    try {
      const urls = await this.photos.signedUrls(
        photos.map((photoId) => ({ ownerId: id, photoId })),
        'full',
      );
      this.fullUrls.set({ id, urls });
    } catch {
      // The thumbnail stays; the other photos show as placeholders.
    }
  }
}
