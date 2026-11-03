import { Component, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { PhotoStorageService } from '../../../core/photo-storage.service';
import { ProfileViewComponent } from '../../../shared/profile-view/profile-view.component';
import { MyProfileStore } from './my-profile.store';

/** The user's own profile as other members see it, over the profile tab. */
@Component({
  selector: 'app-profile-preview',
  standalone: true,
  imports: [MatButtonModule, ProfileViewComponent],
  template: `
    @if (store.member(); as member) {
      <app-profile-view
        [profile]="member"
        [photoUrls]="photoUrls()"
        backLabel="Back to your profile"
      >
        <div class="kt-profile-actions">
          <div class="kt-profile-bar">
            <button mat-flat-button type="button" (click)="view()?.close()">Close preview</button>
          </div>
        </div>
      </app-profile-view>
    }
  `,
  styles: `
    button {
      --mat-button-filled-container-height: 52px;
      --mat-button-filled-label-text-size: 16.5px;
    }
  `,
})
export class ProfilePreviewComponent {
  private readonly photos = inject(PhotoStorageService);
  readonly store = inject(MyProfileStore);
  readonly view = viewChild(ProfileViewComponent);

  /** Full-size photo URLs, in the order of the profile's photos. */
  readonly photoUrls = signal<(string | null)[]>([]);

  constructor() {
    effect(() => {
      const member = this.store.member();
      if (member) untracked(() => void this.loadPhotos(member.id, member.photos));
    });
  }

  private async loadPhotos(ownerId: string, photoIds: string[]) {
    try {
      const urls = await this.photos.signedUrls(
        photoIds.map((photoId) => ({ ownerId, photoId })),
        'full',
      );
      this.photoUrls.set(urls);
    } catch {
      // The photos show as placeholders.
    }
  }
}
