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
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { PhotoStorageService } from '../../../core/photo-storage.service';
import { Member } from '../../../core/profile.model';
import { CLOSE_ANIMATION_MS } from '../../../shared/profile-view/profile-transition';
import { ProfileViewComponent } from '../../../shared/profile-view/profile-view.component';
import { SearchStore } from './search.store';

/** Someone's profile over the search grid, with Reach out and Hide. */
@Component({
  selector: 'app-search-profile',
  standalone: true,
  imports: [MatButtonModule, RouterLink, ProfileViewComponent],
  templateUrl: './search-profile.component.html',
  styleUrl: './search-profile.component.scss',
})
export class SearchProfileComponent {
  private readonly store = inject(SearchStore);
  private readonly photos = inject(PhotoStorageService);
  private readonly route = inject(ActivatedRoute);
  private readonly snackBar = inject(MatSnackBar);

  private readonly view = viewChild(ProfileViewComponent);
  private readonly id = toSignal(this.route.paramMap.pipe(map((params) => params.get('id'))), {
    initialValue: this.route.snapshot.paramMap.get('id'),
  });
  /** Undefined while the members load, null if the viewer can't see this one. */
  readonly member = computed(() =>
    this.store.members() === null ? undefined : this.store.member(this.id()),
  );
  /** Full-size photo URLs, once fetched for the open member. */
  private readonly fullUrls = signal<{ id: string; urls: (string | null)[] } | null>(null);
  /**
   * The cached thumbnail for the main photo until the full-size photos are signed, so the morph
   * lands on a photo straight away; the browser swaps in the full one once it has loaded.
   */
  readonly photoUrls = computed(() => {
    const member = this.member();
    if (!member) return [];
    const full = this.fullUrls();
    if (full?.id === member.id) return full.urls;
    return [this.store.thumbs().get(member.id) ?? null];
  });

  constructor() {
    // Set during the navigation (not in an effect), so the tile gives up the morph's name
    // before the browser captures the new page.
    this.route.paramMap
      .pipe(takeUntilDestroyed())
      .subscribe((params) => this.store.openId.set(params.get('id')));
    inject(DestroyRef).onDestroy(() => this.store.openId.set(null));

    // Once the member is known (the list may still be loading when opened by its URL).
    effect(() => {
      const member = this.member();
      if (member) untracked(() => this.loadFullPhotos(member));
    });
  }

  /** The accessible alternative to swiping a tile away. */
  async hide(member: Member) {
    // Back to the grid first, so the photo morphs back into its tile, then the tile goes.
    await this.view()?.close();
    setTimeout(() => this.store.hide(member), CLOSE_ANIMATION_MS);
  }

  // Introductions aren't built yet.
  reachOut() {
    this.snackBar.open("Reaching out isn't ready yet. Thanks for testing!", undefined, {
      duration: 4000,
      panelClass: 'kt-snackbar',
    });
  }

  private async loadFullPhotos({ id, photos }: Member) {
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
