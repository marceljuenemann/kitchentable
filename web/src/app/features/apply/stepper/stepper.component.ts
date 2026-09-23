import { Component, OnInit, ViewChild, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatStepperModule, MatStepper } from '@angular/material/stepper';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatToolbarModule } from '@angular/material/toolbar';

import { ProfileService } from '../../../core/profile.service';
import { AuthService } from '../../../core/auth/auth.service';
import { Profile, ProfilePhoto } from '../../../core/profile.model';
import {
  GENDER_OPTIONS,
  SEXUALITY_OPTIONS,
  LOOKING_FOR_OPTIONS,
} from '../../../shared/profile-options';

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

interface PhotoWithUrl extends ProfilePhoto {
  url: string;
}

@Component({
  selector: 'app-stepper',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatStepperModule,
    MatFormFieldModule,
    MatInputModule,
    MatRadioModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatToolbarModule,
  ],
  templateUrl: './stepper.component.html',
  styleUrl: './stepper.component.scss',
})
export class StepperComponent implements OnInit {
  @ViewChild('stepper') stepper?: MatStepper;

  private readonly fb = inject(FormBuilder);
  private readonly profileService = inject(ProfileService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly genderOptions = GENDER_OPTIONS;
  readonly sexualityOptions = SEXUALITY_OPTIONS;
  readonly lookingForOptions = LOOKING_FOR_OPTIONS;
  readonly months = MONTHS;
  readonly years = Array.from({ length: 80 }, (_, i) => new Date().getFullYear() - 18 - i);

  readonly loading = signal(true);
  readonly initialStepIndex = signal(0);
  readonly profile = signal<Profile | null>(null);
  readonly photos = signal<PhotoWithUrl[]>([]);
  readonly saving = signal(false);
  readonly uploadError = signal<string | null>(null);
  readonly submitError = signal<string | null>(null);
  readonly userEmail = signal<string | null>(null);

  readonly locationForm = this.fb.nonNullable.group({
    isLondon: this.fb.nonNullable.control<'london' | 'other'>('london', Validators.required),
    otherLocation: [''],
  });

  readonly aboutForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    pronouns: [''],
    tagline: ['', Validators.required],
    gender: this.fb.nonNullable.control<string[]>([], Validators.required),
    sexuality: this.fb.nonNullable.control<string[]>([], Validators.required),
    birthYear: this.fb.control<number | null>(null, Validators.required),
    birthMonth: this.fb.control<number | null>(null, Validators.required),
    lookingFor: this.fb.nonNullable.control<string[]>([]),
  });

  readonly bioForm = this.fb.nonNullable.group({
    bio: ['', Validators.required],
  });

  readonly questionsForm = this.fb.nonNullable.group({
    consentAnswer: ['', Validators.required],
    enmAnswer: ['', Validators.required],
  });

  async ngOnInit() {
    this.userEmail.set(this.auth.session()?.user.email ?? null);

    const profile = await this.profileService.getMyProfile();
    this.profile.set(profile);
    this.patchForms(profile);

    const photos = await this.profileService.listPhotos();
    const withUrls = await Promise.all(
      photos.map(async (p) => ({
        ...p,
        url: await this.profileService.getPhotoUrl(p.storage_path),
      })),
    );
    this.photos.set(withUrls);
    // Computed before the stepper exists (behind the `loading` @else) and
    // passed in as its initial [selectedIndex] input, rather than poking
    // the ViewChild after render -- CdkStepper's own content-init logic
    // runs after that point and silently overwrites a post-hoc assignment.
    this.initialStepIndex.set(this.computeInitialStepIndex(profile, withUrls.length));

    this.loading.set(false);
  }

  private patchForms(profile: Profile) {
    const isOther = !!profile.location && profile.location !== 'London';
    this.locationForm.patchValue({
      isLondon: isOther ? 'other' : 'london',
      otherLocation: isOther ? profile.location! : '',
    });

    this.aboutForm.patchValue({
      name: profile.name ?? '',
      pronouns: profile.pronouns ?? '',
      tagline: profile.tagline ?? '',
      gender: profile.gender ?? [],
      sexuality: profile.sexuality ?? [],
      birthYear: profile.birth_year,
      birthMonth: profile.birth_month,
      lookingFor: profile.looking_for ?? [],
    });

    this.bioForm.patchValue({ bio: profile.bio ?? '' });

    this.questionsForm.patchValue({
      consentAnswer: profile.application_consent_answer ?? '',
      enmAnswer: profile.application_enm_answer ?? '',
    });
  }

  // Deliberately checks the *saved* profile, not current form validity --
  // some controls (like the location radio) are "valid" from their default
  // value alone, which would otherwise skip a step the user never actually
  // saved.
  private computeInitialStepIndex(p: Profile, photoCount: number): number {
    if (!p.location) return 0;

    const aboutComplete =
      !!p.name &&
      !!p.tagline &&
      p.gender.length > 0 &&
      p.sexuality.length > 0 &&
      p.birth_year != null &&
      p.birth_month != null;
    if (!aboutComplete) return 1;

    if (!p.bio) return 2;
    if (photoCount === 0) return 3;

    return 4;
  }

  async saveLocationAndNext() {
    if (this.locationForm.invalid) return;
    const { isLondon, otherLocation } = this.locationForm.getRawValue();
    await this.save({ location: isLondon === 'london' ? 'London' : otherLocation });
    this.stepper?.next();
  }

  async saveAboutAndNext() {
    if (this.aboutForm.invalid) return;
    const v = this.aboutForm.getRawValue();
    await this.save({
      name: v.name,
      pronouns: v.pronouns,
      tagline: v.tagline,
      gender: v.gender,
      sexuality: v.sexuality,
      birth_year: v.birthYear,
      birth_month: v.birthMonth,
      looking_for: v.lookingFor,
    });
    this.stepper?.next();
  }

  async saveBioAndNext() {
    if (this.bioForm.invalid) return;
    await this.save({ bio: this.bioForm.getRawValue().bio });
    this.stepper?.next();
  }

  async submitApplication() {
    if (this.questionsForm.invalid) return;
    this.saving.set(true);
    this.submitError.set(null);
    const { consentAnswer, enmAnswer } = this.questionsForm.getRawValue();
    try {
      const updated = await this.profileService.updateProfile({
        application_consent_answer: consentAnswer,
        application_enm_answer: enmAnswer,
        application_status: 'pending',
      });
      this.profile.set(updated);
    } catch (err) {
      this.submitError.set(this.readableError(err));
    } finally {
      this.saving.set(false);
    }
  }

  private async save(patch: Partial<Profile>) {
    this.saving.set(true);
    try {
      const updated = await this.profileService.updateProfile(patch);
      this.profile.set(updated);
    } finally {
      this.saving.set(false);
    }
  }

  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.uploadError.set(null);
    try {
      const photo = await this.profileService.uploadPhoto(file, this.photos().length);
      const url = await this.profileService.getPhotoUrl(photo.storage_path);
      this.photos.update((list) => [...list, { ...photo, url }]);
    } catch (err) {
      this.uploadError.set(this.readableError(err));
    }
  }

  async removePhoto(photo: PhotoWithUrl) {
    await this.profileService.deletePhoto(photo);
    this.photos.update((list) => list.filter((p) => p.id !== photo.id));
  }

  async signOut() {
    await this.auth.signOut();
    this.router.navigateByUrl('/apply/start');
  }

  private readableError(err: unknown): string {
    return err instanceof Error ? err.message : 'Something went wrong, please try again.';
  }
}
