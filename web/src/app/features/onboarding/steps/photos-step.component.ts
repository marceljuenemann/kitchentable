import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { PhotoStorageService } from '../../../core/photo-storage.service';
import { ProfileService } from '../../../core/profile.service';
import { PhotoGridComponent } from '../../../shared/profile-edit/photo-grid/photo-grid.component';
import { OnboardingDraftStore, STEPS_SHOWN, toNewProfile } from '../onboarding-draft.store';

/** Onboarding step 3, the last of the form: add and crop up to six photos, then submit. */
@Component({
  selector: 'app-photos-step',
  standalone: true,
  imports: [MatButtonModule, PhotoGridComponent],
  templateUrl: './photos-step.component.html',
  styleUrl: './photos-step.component.scss',
})
export class PhotosStepComponent {
  readonly store = inject(OnboardingDraftStore);
  private readonly storage = inject(PhotoStorageService);
  private readonly profiles = inject(ProfileService);

  readonly photoIds = computed(() => this.store.draft().photos);
  readonly totalSteps = STEPS_SHOWN;
  readonly submitting = signal(false);
  readonly failed = signal(false);

  readonly canSubmit = computed(() => !this.submitting() && this.photoIds().length > 0);

  /** The photo isn't on a profile yet, so its files can go first. */
  readonly remove = async (id: string) => {
    await this.storage.remove(id);
    this.store.removePhoto(id);
  };

  /** Creates the profile; the shell then shows the next screen, so nothing is navigated here. */
  async submit() {
    if (!this.canSubmit()) return;
    this.submitting.set(true);
    this.failed.set(false);
    try {
      await this.profiles.submitOnboarding(toNewProfile(this.store.draft()));
    } catch {
      this.failed.set(true);
      this.submitting.set(false);
    }
  }
}
