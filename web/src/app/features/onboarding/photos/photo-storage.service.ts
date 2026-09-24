import { Injectable, inject } from '@angular/core';
import { AuthService } from '../../../core/auth/auth.service';
import { SupabaseService } from '../../../core/supabase.service';
import { ProcessedPhoto } from './photo-processor';

const BUCKET = 'photos';
/** Signed URLs are valid for an hour; the bucket is private (see docs/photos.md). */
const SIGNED_URL_SECONDS = 60 * 60;

type Version = 'full' | 'thumb';

/**
 * Photos in the private `photos` bucket, at `<user id>/<photo id>/full.jpg` and `thumb.jpg`.
 * A photo is identified by its id alone; the paths are derived (see docs/photos.md).
 */
@Injectable({ providedIn: 'root' })
export class PhotoStorageService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);

  private get bucket() {
    return this.supabase.client.storage.from(BUCKET);
  }

  /** Uploads both versions of a photo; if either fails, neither is left behind. */
  async upload(id: string, photo: ProcessedPhoto): Promise<void> {
    const paths = this.paths(id);
    const options = { contentType: 'image/jpeg', cacheControl: '3600', upsert: false };
    const [full, thumb] = await Promise.all([
      this.bucket.upload(paths.full, photo.full, options),
      this.bucket.upload(paths.thumb, photo.thumb, options),
    ]);
    const error = full.error ?? thumb.error;
    if (error) {
      await this.bucket.remove([paths.full, paths.thumb]);
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    const paths = this.paths(id);
    const { error } = await this.bucket.remove([paths.full, paths.thumb]);
    if (error) throw error;
  }

  /** Signed thumbnail URLs by photo id; a photo whose file no longer exists maps to null. */
  async thumbUrls(ids: string[]): Promise<Map<string, string | null>> {
    const result = new Map<string, string | null>(ids.map((id) => [id, null]));
    if (ids.length === 0) return result;
    const paths = ids.map((id) => this.paths(id).thumb);
    const { data, error } = await this.bucket.createSignedUrls(paths, SIGNED_URL_SECONDS);
    if (error) throw error;
    data.forEach((entry, index) => {
      result.set(ids[index], entry.error ? null : entry.signedUrl);
    });
    return result;
  }

  private paths(id: string): Record<Version, string> {
    const userId = this.auth.session()?.user.id;
    if (!userId) throw new Error('Not signed in');
    return { full: `${userId}/${id}/full.jpg`, thumb: `${userId}/${id}/thumb.jpg` };
  }
}
