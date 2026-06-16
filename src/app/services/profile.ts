import { Injectable, inject } from '@angular/core';
import { User } from '@supabase/supabase-js';

import { Profile } from '../interfaces/profile.interface';
import { SupabaseService } from './supabase';

@Injectable({
  providedIn: 'root',
})
export class ProfileService {
  private readonly supabase = inject(SupabaseService);

  profile(user: User) {
    return this.supabase.client
      .from('profiles')
      .select('username, website, avatar_url')
      .eq('id', user.id)
      .single();
  }

  profileUsername(user: User) {
    return this.supabase.client.from('profiles').select('username').eq('id', user.id).maybeSingle();
  }

  profileById(userId: string) {
    return this.supabase.client.from('profiles').select('username').eq('id', userId).maybeSingle();
  }

  profilesByIds(userIds: readonly string[]) {
    return this.supabase.client.from('profiles').select('id, username, avatar_url').in('id', userIds);
  }

  updateProfile(profile: Profile) {
    const update = {
      ...profile,
      updated_at: new Date(),
    };

    return this.supabase.client.from('profiles').upsert(update);
  }

  updateUsername(userId: string, username: string) {
    return this.supabase.client
      .from('profiles')
      .update({ username, updated_at: new Date().toISOString() })
      .eq('id', userId);
  }

  async userHasUsername(user: User): Promise<boolean> {
    const { data, error } = await this.profileUsername(user);

    if (error) {
      throw error;
    }

    return this.isUsernameComplete(data?.username);
  }

  async isUsernameAvailable(username: string, currentUserId?: string): Promise<boolean> {
    const normalizedUsername = username.trim();

    let query = this.supabase.client
      .from('profiles')
      .select('id')
      .eq('username', normalizedUsername);

    if (currentUserId) {
      query = query.neq('id', currentUserId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      throw error;
    }

    return data === null;
  }

  isUsernameComplete(username: string | null | undefined): boolean {
    return typeof username === 'string' && username.trim().length > 0;
  }

  downloadImage(path: string) {
    return this.supabase.client.storage.from('profile-avatars').download(path);
  }

  uploadAvatar(filePath: string, file: File) {
    return this.supabase.client.storage.from('profile-avatars').upload(filePath, file);
  }
}
