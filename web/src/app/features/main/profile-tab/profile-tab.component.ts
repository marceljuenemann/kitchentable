import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { injectSignOut } from '../../../core/auth/sign-out';
import { ageFrom } from '../../../core/age';
import { PhotoStorageService } from '../../../core/photo-storage.service';
import { MyProfile } from '../../../core/profile.model';
import {
  ABOUT_MIN_LENGTH,
  LOOKING_FOR_OPTIONS,
  TAGLINE_MAX_LENGTH,
  lookingForLabel,
  lookingForValueFor,
} from '../../../core/profile-options';
import { LegalLinksComponent } from '../../../shared/legal-links/legal-links.component';
import { AgeSheetComponent } from '../../../shared/profile-edit/age-sheet/age-sheet.component';
import {
  LIST_FIELD_SHEETS,
  ListField,
  PROFILE_SHEET_CONFIG,
} from '../../../shared/profile-edit/field-sheets';
import {
  OptionSheetComponent,
  OptionSheetData,
} from '../../../shared/profile-edit/option-sheet/option-sheet.component';
import { PhotoGridComponent } from '../../../shared/profile-edit/photo-grid/photo-grid.component';
import {
  TextSheetComponent,
  TextSheetData,
} from '../../../shared/profile-edit/text-sheet/text-sheet.component';
import { photoTransitionName } from '../../../shared/profile-view/profile-transition';
import { MyProfileStore } from './my-profile.store';

type TextField = 'name' | 'tagline' | 'bio';
/** Location isn't here: changing it isn't supported yet. */
type Field = TextField | ListField | 'age' | 'looking_for';

interface Row {
  field: Field;
  label: string;
  emptyText: string;
  value: string;
}

interface Group {
  title: string;
  rows: Row[];
}

const TEXT_SHEETS: Record<TextField, Omit<TextSheetData, 'value'>> = {
  name: { title: 'Name', placeholder: 'What should people call you?', autocomplete: 'given-name' },
  tagline: {
    title: 'Tagline',
    placeholder: 'One line summary that people see first',
    maxLength: TAGLINE_MAX_LENGTH,
    optional: true,
  },
  bio: {
    title: 'About me',
    placeholder: 'Tell people more about yourself',
    multiline: true,
    minLength: ABOUT_MIN_LENGTH,
  },
};

const LOOKING_FOR_SHEET: Omit<OptionSheetData, 'selected'> = {
  title: 'Looking for',
  help: 'Pick any that apply, or add your own.',
  options: LOOKING_FOR_OPTIONS.map((option) => option.id),
  multi: true,
  placeholder: 'e.g. Running buddies',
  accent: 'primary',
  required: true,
  label: lookingForLabel,
  valueFor: lookingForValueFor,
};

/**
 * The "Your profile" tab: the user's photos to add, remove and reorder, the fields in groups, a
 * row each that opens a sheet to edit it, and Preview, which opens the profile as other members see it as
 * a child route (so the page scrolls itself, like search). Then the account: signing out, and
 * the legal documents (also on the Community tab).
 */
@Component({
  selector: 'app-profile-tab',
  standalone: true,
  imports: [
    LegalLinksComponent,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    PhotoGridComponent,
    RouterLink,
    RouterOutlet,
  ],
  templateUrl: './profile-tab.component.html',
  styleUrl: './profile-tab.component.scss',
  host: { class: 'kt-scroller', '[class.covering]': 'previewOpen()' },
})
export class ProfileTabComponent {
  private readonly bottomSheet = inject(MatBottomSheet);
  private readonly photoStorage = inject(PhotoStorageService);
  readonly store = inject(MyProfileStore);

  readonly session = inject(AuthService).session;
  readonly signOut = injectSignOut();

  /** Whether the preview shows over the page, which raises the page over the bottom nav. */
  readonly previewOpen = signal(false);
  /** While the preview shows, the main photo gives up the name to the preview's. */
  readonly mainTransitionName = computed(() => {
    const profile = this.store.profile();
    return profile && !this.previewOpen() ? photoTransitionName(profile.id) : null;
  });
  /** The main photo's thumbnail, for the tile in the Tagline sheet. */
  private readonly mainThumb = signal<{ id: string; url: string | null } | null>(null);

  constructor() {
    effect(() => {
      const id = this.store.profile()?.photos[0];
      if (id && id !== untracked(this.mainThumb)?.id) void this.loadMainThumb(id);
    });
  }

  /** The fields in groups, what people write about themselves first. */
  readonly groups = computed<Group[]>(() => {
    const profile = this.store.profile();
    if (!profile) return [];
    const age = ageFrom(`${profile.birth_month ?? ''}`, `${profile.birth_year ?? ''}`);
    return [
      {
        title: 'Profile',
        rows: [
          {
            field: 'tagline',
            label: 'Tagline',
            emptyText: 'Add a tagline',
            value: profile.tagline,
          },
          { field: 'bio', label: 'About me', emptyText: 'Add about me', value: profile.bio },
          {
            field: 'looking_for',
            label: 'Looking for',
            emptyText: 'Add what you are looking for',
            value: profile.looking_for.map(lookingForLabel).join(', '),
          },
        ],
      },
      {
        title: 'Identity',
        rows: [
          {
            field: 'gender',
            label: 'Gender',
            emptyText: 'Add gender',
            value: profile.gender.join(', '),
          },
          {
            field: 'sexuality',
            label: 'Sexuality',
            emptyText: 'Add sexuality',
            value: profile.sexuality.join(', '),
          },
        ],
      },
      {
        title: 'Basics',
        rows: [
          { field: 'name', label: 'Name', emptyText: 'Add name', value: profile.name },
          {
            field: 'pronouns',
            label: 'Pronouns',
            emptyText: 'Add pronouns',
            value: profile.pronouns,
          },
          {
            field: 'age',
            label: 'Age',
            emptyText: 'Add birthday',
            value: age === null ? '' : `${age}`,
          },
        ],
      },
    ];
  });

  /** Until saving is built, the files stay: the saved profile still shows the photo. */
  readonly removePhoto = (id: string) =>
    this.savePhotos(this.photos().filter((photoId) => photoId !== id));

  addPhoto(id: string) {
    void this.savePhotos([...this.photos(), id]);
  }

  savePhotos(photos: string[]) {
    return this.store.save({ photos });
  }

  openRow(field: Field) {
    const profile = this.store.profile();
    if (!profile) return;
    switch (field) {
      case 'name':
      case 'tagline':
      case 'bio':
        this.bottomSheet
          .open<TextSheetComponent, TextSheetData, string>(TextSheetComponent, {
            ...PROFILE_SHEET_CONFIG,
            data: {
              ...TEXT_SHEETS[field],
              value: profile[field],
              tile: field === 'tagline' ? this.tile(profile) : undefined,
            },
          })
          .afterDismissed()
          .subscribe((value) => value !== undefined && this.store.save({ [field]: value }));
        return;
      case 'pronouns':
        this.openOptions({ ...LIST_FIELD_SHEETS.pronouns, selected: [profile.pronouns] }, (value) =>
          this.store.save({ pronouns: value[0] }),
        );
        return;
      case 'gender':
      case 'sexuality':
        this.openOptions({ ...LIST_FIELD_SHEETS[field], selected: profile[field] }, (value) =>
          this.store.save({ [field]: value }),
        );
        return;
      case 'looking_for':
        this.openOptions({ ...LOOKING_FOR_SHEET, selected: profile.looking_for }, (value) =>
          this.store.save({ looking_for: value }),
        );
        return;
      case 'age':
        this.bottomSheet
          .open(AgeSheetComponent, {
            ...PROFILE_SHEET_CONFIG,
            data: {
              birthMonth: `${profile.birth_month ?? ''}`,
              birthYear: `${profile.birth_year ?? ''}`,
            },
          })
          .afterDismissed()
          .subscribe((result) => {
            if (!result) return;
            const hasBirthday = result.birthMonth !== '' && result.birthYear !== '';
            void this.store.save({
              birth_month: hasBirthday ? Number(result.birthMonth) : null,
              birth_year: hasBirthday ? Number(result.birthYear) : null,
            });
          });
        return;
    }
  }

  private photos(): string[] {
    return this.store.profile()?.photos ?? [];
  }

  private tile({ id, name, photos }: MyProfile): TextSheetData['tile'] {
    const thumb = this.mainThumb();
    return { id, name, photoUrl: thumb && thumb.id === photos[0] ? thumb.url : null };
  }

  private async loadMainThumb(id: string) {
    try {
      const urls = await this.photoStorage.thumbUrls([id]);
      this.mainThumb.set({ id, url: urls.get(id) ?? null });
    } catch {
      // The tile shows the initial instead.
    }
  }

  private openOptions(data: OptionSheetData, save: (value: string[]) => void) {
    this.bottomSheet
      .open<OptionSheetComponent, OptionSheetData, string[]>(OptionSheetComponent, {
        ...PROFILE_SHEET_CONFIG,
        data,
      })
      .afterDismissed()
      .subscribe((value) => value && save(value));
  }
}
