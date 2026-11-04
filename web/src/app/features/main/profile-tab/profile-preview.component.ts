import { Component, inject, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { injectProfilePhotoUrls } from '../../../shared/profile-view/profile-photo-urls';
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
  readonly store = inject(MyProfileStore);
  readonly view = viewChild(ProfileViewComponent);
  /** No cached thumbnail here: the photo grid keeps its own. */
  readonly photoUrls = injectProfilePhotoUrls(this.store.member, () => null);
}
