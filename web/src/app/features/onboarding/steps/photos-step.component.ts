import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { PhotoStorageService } from '../../../core/photo-storage.service';
import { PhotoGridComponent } from '../../../shared/profile-edit/photo-grid/photo-grid.component';
import { OnboardingDraftStore, ONBOARDING_STEPS } from '../onboarding-draft.store';

/** Onboarding step 3: add and crop up to six photos. */
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

  readonly photoIds = computed(() => this.store.draft().photos);
  readonly totalSteps = ONBOARDING_STEPS;

  readonly canContinue = computed(() => this.photoIds().length > 0);

  /** The photo isn't on a profile yet, so its files can go first. */
  readonly remove = async (id: string) => {
    await this.storage.remove(id);
    this.store.removePhoto(id);
  };

  next() {
    if (this.canContinue()) this.store.update({ step: 4 });
  }
}
