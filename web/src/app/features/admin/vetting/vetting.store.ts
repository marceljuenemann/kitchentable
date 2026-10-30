import { Injectable, inject, signal } from '@angular/core';
import { ageFrom } from '../../../core/age';
import { PhotoStorageService } from '../../../core/photo-storage.service';
import { Member, Profile } from '../../../core/profile.model';
import { SupabaseService } from '../../../core/supabase.service';

/**
 * A profile in `vetting`, whole, as `admin_list_applications()` returns it, plus the age it will
 * show to members.
 */
export interface Application extends Profile, Member {
  /** Answers by question id, plus `invite_code` and `onboarding_feedback` if given. */
  vetting_answers: Record<string, string>;
  created_at: string;
}

/**
 * The applications waiting for review, shared by the grid and the profile route. Profiles come
 * whole in one request, so opening one needs no further request (see docs/database.md).
 */
@Injectable()
export class VettingStore {
  private readonly supabase = inject(SupabaseService);
  private readonly photos = inject(PhotoStorageService);

  /** Null while loading. */
  readonly applications = signal<Application[] | null>(null);
  readonly loadFailed = signal(false);
  /** Main photo thumbnails by profile id. */
  readonly thumbs = signal(new Map<string, string | null>());
  /** The application showing over the grid, if any. */
  readonly openId = signal<string | null>(null);

  async load(): Promise<void> {
    this.loadFailed.set(false);
    try {
      const { data, error } = await this.supabase.client.rpc('admin_list_applications');
      if (error) throw error;
      const applications = (data as Omit<Application, 'age'>[]).map((application) => ({
        ...application,
        age: ageFrom(`${application.birth_month ?? ''}`, `${application.birth_year ?? ''}`),
      }));
      this.applications.set(applications);
      await this.loadThumbs(applications);
    } catch {
      this.loadFailed.set(true);
    }
  }

  async approve(id: string): Promise<void> {
    const { error } = await this.supabase.client.rpc('admin_approve_application', { p_id: id });
    if (error) throw error;
  }

  /** Takes an approved application off the list. */
  remove(id: string) {
    this.applications.update(
      (list) => list?.filter((application) => application.id !== id) ?? null,
    );
  }

  private async loadThumbs(applications: Application[]) {
    const withPhoto = applications.filter((application) => application.photos.length > 0);
    const urls = await this.photos.signedUrls(
      withPhoto.map(({ id, photos }) => ({ ownerId: id, photoId: photos[0] })),
      'thumb',
    );
    this.thumbs.set(new Map(withPhoto.map(({ id }, index) => [id, urls[index]])));
  }
}
