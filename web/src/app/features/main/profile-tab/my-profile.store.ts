import { Injectable, computed, inject, linkedSignal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatSnackBar } from '@angular/material/snack-bar';
import { map } from 'rxjs';
import { ageFrom } from '../../../core/age';
import { Member, MyProfile, NewProfile, Settings } from '../../../core/profile.model';
import { ProfileService } from '../../../core/profile.service';
import { SupabaseService } from '../../../core/supabase.service';

/** What `update_profile` saves: each field is the argument of the same name, with a `p_` prefix. */
const EDITABLE_FIELDS = [
  'name',
  'pronouns',
  'tagline',
  'bio',
  'gender',
  'sexuality',
  'birth_year',
  'birth_month',
  'looking_for',
  'photos',
] as const;

/** The fields the profile tab edits. */
export type ProfileChanges = Partial<Pick<NewProfile, (typeof EDITABLE_FIELDS)[number]>>;

/** What `update_settings` saves, the same way. */
const SETTINGS = ['intro_emails', 'message_emails'] as const satisfies (keyof Settings)[];

/** The settings in the profile (all on until it has loaded, as for a new profile). */
function settingsOf(profile: MyProfile | null): Settings {
  return {
    intro_emails: profile?.intro_emails ?? true,
    message_emails: profile?.message_emails ?? true,
  };
}

/** The user's own profile as other members see it. */
export function toMember(profile: MyProfile): Member {
  const { id, name, pronouns, tagline, bio, location, gender, sexuality, looking_for, photos } =
    profile;
  return {
    id,
    name,
    pronouns,
    tagline,
    bio,
    location,
    gender,
    sexuality,
    looking_for,
    photos,
    age: ageFrom(`${profile.birth_month ?? ''}`, `${profile.birth_year ?? ''}`),
  };
}

/** The fields that differ, as they are in `to`. */
function changesBetween(from: MyProfile, to: MyProfile): ProfileChanges {
  return Object.fromEntries(
    EDITABLE_FIELDS.filter(
      (field) => JSON.stringify(from[field]) !== JSON.stringify(to[field]),
    ).map((field) => [field, to[field]]),
  );
}

/**
 * The profile the profile tab edits, provided on its route (so it lasts while you visit other
 * tabs, and the preview shares it). An edit shows straight away and is saved with
 * `update_profile`, which takes the whole set of fields. The profile stays here rather than going
 * back into ProfileService: reloading that would make the shell replace the screen.
 */
@Injectable()
export class MyProfileStore {
  private readonly supabase = inject(SupabaseService);
  private readonly snackBar = inject(MatSnackBar);

  private readonly loaded = toSignal(
    inject(ProfileService).state$.pipe(
      map((state) => (state.kind === 'loaded' ? state.profile : null)),
    ),
    { initialValue: null },
  );
  /** What the server has: the loaded profile, then each save that worked. */
  private readonly saved = linkedSignal(() => this.loaded());
  private readonly current = linkedSignal(() => this.loaded());
  /** Saves run one at a time, each sending the profile as it is by then. */
  private queue: Promise<unknown> = Promise.resolve();
  /** The Settings sheet's settings, saved with `update_settings` rather than with the fields. */
  private readonly savedSettings = linkedSignal(() => settingsOf(this.loaded()));
  private readonly currentSettings = linkedSignal(() => settingsOf(this.loaded()));

  /** Null only until it has loaded (the main app shows once it has, so hardly ever). */
  readonly profile = this.current.asReadonly();
  readonly member = computed(() => {
    const profile = this.profile();
    return profile && toMember(profile);
  });
  readonly settings = this.currentSettings.asReadonly();

  /**
   * Shows the change and saves it. Resolves with whether it was saved. If it wasn't, the profile
   * goes back to what was saved, with a snackbar to try again.
   */
  save(changes: ProfileChanges): Promise<boolean> {
    this.current.update((profile) => profile && { ...profile, ...changes });
    const saved = this.queue.then(() => this.send());
    this.queue = saved;
    return saved;
  }

  private async send(): Promise<boolean> {
    const profile = this.current();
    const saved = this.saved();
    if (!profile || !saved) return false;
    // An earlier save already sent this change along with its own.
    if (profile === saved) return true;
    try {
      const args = Object.fromEntries(
        EDITABLE_FIELDS.map((field) => [`p_${field}`, profile[field]]),
      );
      const { error } = await this.supabase.client.rpc('update_profile', args);
      if (error) throw error;
      this.saved.set(profile);
      return true;
    } catch (error) {
      console.warn('Could not save the profile', error);
      // Edited again meanwhile: the save for that is still to come, with this change in it.
      if (this.current() !== profile) return false;
      this.current.set(saved);
      const changes = changesBetween(saved, profile);
      this.snackBar
        .open("Couldn't save your profile", 'Retry', { duration: 6000, panelClass: 'kt-snackbar' })
        .onAction()
        .subscribe(() => void this.save(changes));
      return false;
    }
  }

  /** Like `save`, for the settings: shows the change, then saves them in turn with the profile. */
  updateSettings(changes: Partial<Settings>): Promise<boolean> {
    this.currentSettings.update((settings) => ({ ...settings, ...changes }));
    const saved = this.queue.then(() => this.sendSettings());
    this.queue = saved;
    return saved;
  }

  private async sendSettings(): Promise<boolean> {
    const settings = this.currentSettings();
    const saved = this.savedSettings();
    // Switched back meanwhile, or already sent with an earlier save.
    if (SETTINGS.every((setting) => settings[setting] === saved[setting])) return true;
    try {
      const args = Object.fromEntries(
        SETTINGS.map((setting) => [`p_${setting}`, settings[setting]]),
      );
      const { error } = await this.supabase.client.rpc('update_settings', args);
      if (error) throw error;
      this.savedSettings.set(settings);
      return true;
    } catch (error) {
      console.warn('Could not save the settings', error);
      if (this.currentSettings() !== settings) return false;
      this.currentSettings.set(saved);
      this.snackBar
        .open("Couldn't save your settings", 'Retry', { duration: 6000, panelClass: 'kt-snackbar' })
        .onAction()
        .subscribe(() => void this.updateSettings(settings));
      return false;
    }
  }
}
