import {
  Component,
  computed,
  DestroyRef,
  inject,
  viewChild,
  ViewContainerRef,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { ConnectionsStore } from '../../../core/connections/connections.store';
import { Member } from '../../../core/profile.model';
import { HeartComponent } from '../../../shared/heart/heart.component';
import { HideIconComponent } from '../../../shared/hide-icon/hide-icon.component';
import { injectProfilePhotoUrls } from '../../../shared/profile-view/profile-photo-urls';
import { CLOSE_ANIMATION_MS } from '../../../shared/profile-view/profile-transition';
import { ProfileViewComponent } from '../../../shared/profile-view/profile-view.component';
import { ReachOutSheetComponent } from './reach-out-sheet.component';
import { SearchStore } from './search.store';

/** Someone's profile over the search grid, with Reach out and Hide. */
@Component({
  selector: 'app-search-profile',
  standalone: true,
  imports: [HeartComponent, HideIconComponent, MatButtonModule, RouterLink, ProfileViewComponent],
  templateUrl: './search-profile.component.html',
  styleUrl: './search-profile.component.scss',
})
export class SearchProfileComponent {
  private readonly store = inject(SearchStore);
  private readonly route = inject(ActivatedRoute);
  private readonly bottomSheet = inject(MatBottomSheet);
  private readonly viewContainerRef = inject(ViewContainerRef);

  private readonly view = viewChild(ProfileViewComponent);
  private readonly id = toSignal(this.route.paramMap.pipe(map((params) => params.get('id'))), {
    initialValue: this.route.snapshot.paramMap.get('id'),
  });
  /** Undefined while the members load, null if the viewer can't see this one. */
  readonly member = computed(() =>
    this.store.members() === null ? undefined : this.store.member(this.id()),
  );
  readonly photoUrls = injectProfilePhotoUrls(this.member, () => {
    const member = this.member();
    return (member && this.store.thumbs().get(member.id)) ?? null;
  });
  readonly introsRemaining = inject(ConnectionsStore).introsLeftToday;

  constructor() {
    // Set during the navigation (not in an effect), so the tile gives up the morph's name
    // before the browser captures the new page.
    this.route.paramMap
      .pipe(takeUntilDestroyed())
      .subscribe((params) => this.store.openId.set(params.get('id')));
    inject(DestroyRef).onDestroy(() => this.store.openId.set(null));
  }

  /** The accessible alternative to swiping a tile away. */
  hide(member: Member) {
    void this.closeThen(() => this.store.hide(member));
  }

  reachOut(member: Member) {
    this.bottomSheet
      .open<ReachOutSheetComponent, Member, boolean>(ReachOutSheetComponent, {
        data: member,
        panelClass: ['kt-bottom-sheet', 'kt-bottom-sheet-inner-scroll'],
        autoFocus: 'dialog',
        // So the sheet gets the main app's ConnectionsStore.
        viewContainerRef: this.viewContainerRef,
      })
      .afterDismissed()
      .subscribe((sent) => {
        if (sent) void this.closeThen(() => this.store.showIntroSent(member));
      });
  }

  /** Back to the grid first, so the photo morphs back into its tile, then the tile goes. */
  private async closeThen(takeOffGrid: () => void) {
    await this.view()?.close();
    setTimeout(takeOffGrid, CLOSE_ANIMATION_MS);
  }
}
