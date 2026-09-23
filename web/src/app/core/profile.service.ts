import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Profile, ProfilePhoto } from './profile.model';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly supabase = inject(SupabaseService);

  async getMyProfile(): Promise<Profile> {
    const {
      data: { session },
    } = await this.supabase.client.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const { data, error } = await this.supabase.client
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (error) throw error;
    return data as Profile;
  }

  async updateProfile(patch: Partial<Profile>): Promise<Profile> {
    const {
      data: { session },
    } = await this.supabase.client.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const { data, error } = await this.supabase.client
      .from('profiles')
      .update(patch)
      .eq('id', session.user.id)
      .select('*')
      .single();

    if (error) throw error;
    return data as Profile;
  }

  async listPhotos(): Promise<ProfilePhoto[]> {
    const { data, error } = await this.supabase.client
      .from('profile_photos')
      .select('*')
      .order('position', { ascending: true });

    if (error) throw error;
    return data as ProfilePhoto[];
  }

  async uploadPhoto(file: File, position: number): Promise<ProfilePhoto> {
    const {
      data: { session },
    } = await this.supabase.client.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const extension = file.name.split('.').pop() ?? 'jpg';
    const storagePath = `${session.user.id}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await this.supabase.client.storage
      .from('photos')
      .upload(storagePath, file);
    if (uploadError) throw uploadError;

    const { data, error } = await this.supabase.client
      .from('profile_photos')
      .insert({ profile_id: session.user.id, storage_path: storagePath, position })
      .select('*')
      .single();

    if (error) throw error;
    return data as ProfilePhoto;
  }

  async deletePhoto(photo: ProfilePhoto): Promise<void> {
    const { error: removeError } = await this.supabase.client.storage
      .from('photos')
      .remove([photo.storage_path]);
    if (removeError) throw removeError;

    const { error } = await this.supabase.client.from('profile_photos').delete().eq('id', photo.id);
    if (error) throw error;
  }

  async getPhotoUrl(storagePath: string): Promise<string> {
    const { data, error } = await this.supabase.client.storage
      .from('photos')
      .createSignedUrl(storagePath, 60 * 60);
    if (error) throw error;
    return data.signedUrl;
  }
}
