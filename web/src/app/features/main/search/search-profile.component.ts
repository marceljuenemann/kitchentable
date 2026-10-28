import { Component, computed, DestroyRef, inject, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { CLOSE_ANIMATION_MS } from '../../../shared/profile-view/profile-transition';
import { ProfileViewComponent } from '../../../shared/profile-view/profile-view.component';
import { Member, SearchStore } from './search.store';

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
  private readonly route = inject(ActivatedRoute);
  private readonly snackBar = inject(MatSnackBar);

  private readonly view = viewChild(ProfileViewComponent);
  private readonly id = toSignal(this.route.paramMap.pipe(map((params) => params.get('id'))), {
    initialValue: this.route.snapshot.paramMap.get('id'),
  });
  readonly member = computed(() => this.store.member(this.id()));
  readonly photoUrls = computed(() => this.store.photoUrls().get(this.id() ?? '') ?? []);

  constructor() {
    // Set during the navigation (not in an effect), so the tile gives up the morph's name
    // before the browser captures the new page.
    this.route.paramMap
      .pipe(takeUntilDestroyed())
      .subscribe((params) => this.store.openId.set(params.get('id')));
    inject(DestroyRef).onDestroy(() => this.store.openId.set(null));
  }

  /** The accessible alternative to swiping a tile away. */
  async hide(member: Member) {
    // Back to the grid first, so the photo morphs back into its tile, then the tile goes.
    await this.view()?.close();
    setTimeout(() => this.store.hide(member), CLOSE_ANIMATION_MS);
  }

  // MOCK: introductions aren't built yet.
  reachOut() {
    this.snackBar.open("Reaching out isn't ready yet. Thanks for testing!", undefined, {
      duration: 4000,
      panelClass: 'kt-snackbar',
    });
  }
}
