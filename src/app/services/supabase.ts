import { Injectable } from '@angular/core';
import {
  AuthChangeEvent,
  createClient,
  Session,
  SupabaseClient,
  User,
} from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

export interface Profile {
  id?: string;
  username: string | null;
  website: string | null;
  avatar_url: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(environment.supabaseUrl, environment.supabasePublishableKey);
  }

  async getUser(): Promise<User | null> {
    const { data, error } = await this.supabase.auth.getUser();
    if (error) {
      return null;
    }
    return data.user;
  }

  profile(user: User) {
    return this.supabase
      .from('profiles')
      .select(`username, website, avatar_url`)
      .eq('id', user.id)
      .single();
  }

  profileUsername(user: User) {
    return this.supabase.from('profiles').select('username').eq('id', user.id).maybeSingle();
  }

  authChanges(callback: (event: AuthChangeEvent, session: Session | null) => void) {
    return this.supabase.auth.onAuthStateChange(callback);
  }

  signIn(email: string) {
    return this.supabase.auth.signInWithOtp({ email });
  }

  signOut() {
    return this.supabase.auth.signOut();
  }

  updateProfile(profile: Profile) {
    const update = {
      ...profile,
      updated_at: new Date(),
    };

    return this.supabase.from('profiles').upsert(update);
  }

  updateUsername(userId: string, username: string) {
    return this.supabase
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

    let query = this.supabase.from('profiles').select('id').eq('username', normalizedUsername);

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

  downLoadImage(path: string) {
    return this.supabase.storage.from('profile-avatars').download(path);
  }

  uploadAvatar(filePath: string, file: File) {
    return this.supabase.storage.from('profile-avatars').upload(filePath, file);
  }
}
