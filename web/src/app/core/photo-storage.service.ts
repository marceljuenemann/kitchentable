import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth/auth.service';
import { SupabaseService } from './supabase.service';

const BUCKET = 'photos';
/** Signed URLs are valid for an hour; the bucket is private (see docs/photos.md). */
const SIGNED_URL_SECONDS = 60 * 60;

export type PhotoVersion = 'full' | 'thumb';

/** A stored photo: whose folder it is in, and its id. */
export interface PhotoRef {
  ownerId: string;
  photoId: string;
}

/**
 * Photos in the private `photos` bucket, at `<user id>/<photo id>/full.jpg` and `thumb.jpg`.
 * A photo is identified by its owner and id alone; the paths are derived (see docs/photos.md).
 * Uploading and removing work on the signed-in user's own photos only.
 */
@Injectable({ providedIn: 'root' })
export class PhotoStorageService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);

  private get bucket() {
    return this.supabase.client.storage.from(BUCKET);
  }

  /** Uploads both versions of a photo; if either fails, neither is left behind. */
  async upload(id: string, photo: Record<PhotoVersion, Blob>): Promise<void> {
    const paths = this.ownPaths(id);
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
    const paths = this.ownPaths(id);
    const { error } = await this.bucket.remove([paths.full, paths.thumb]);
    if (error) throw error;
  }

  /** Signed thumbnail URLs of the user's own photos by id; a missing file maps to null. */
  async thumbUrls(ids: string[]): Promise<Map<string, string | null>> {
    const ownerId = this.userId();
    const urls = await this.signedUrls(
      ids.map((photoId) => ({ ownerId, photoId })),
      'thumb',
    );
    return new Map(ids.map((id, index) => [id, urls[index]]));
  }

  /**
   * Signed URLs of anyone's photos (the storage policies decide whose the caller may see), in
   * the order given, in one request. A photo whose file is missing or not visible maps to null.
   */
  async signedUrls(photos: PhotoRef[], version: PhotoVersion): Promise<(string | null)[]> {
    if (photos.length === 0) return [];
    const paths = photos.map(({ ownerId, photoId }) => path(ownerId, photoId, version));
    const { data, error } = await this.bucket.createSignedUrls(paths, SIGNED_URL_SECONDS);
    if (error) throw error;
    return data.map((entry) => (entry.error ? null : entry.signedUrl));
  }

  private ownPaths(id: string): Record<PhotoVersion, string> {
    const userId = this.userId();
    return { full: path(userId, id, 'full'), thumb: path(userId, id, 'thumb') };
  }

  private userId(): string {
    const userId = this.auth.session()?.user.id;
    if (!userId) throw new Error('Not signed in');
    return userId;
  }
}

function path(ownerId: string, photoId: string, version: PhotoVersion): string {
  return `${ownerId}/${photoId}/${version}.jpg`;
}
