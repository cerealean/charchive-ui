import { Injectable } from '@angular/core';
import {
  AuthChangeEvent,
  createClient,
  Session,
  SupabaseClient,
  User,
} from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { CardDetailRecord } from '../interfaces/card-detail-record.interface';
import { CardListRecord } from '../interfaces/card-list-record.interface';
import { Profile } from '../interfaces/profile.interface';

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  private static readonly TOKEN_REFRESH_LEAD_SECONDS = 5 * 60;
  private static readonly MIN_REFRESH_INTERVAL_MS = 30_000;

  private supabase: SupabaseClient;
  private lastRefreshAttemptAt = 0;

  constructor() {
    this.supabase = createClient(environment.supabaseUrl, environment.supabasePublishableKey);
  }

  async getUser(): Promise<User | null> {
    await this.refreshSessionIfNeeded();

    const {
      data: { session },
    } = await this.supabase.auth.getSession();

    if (session?.user) {
      return session.user;
    }

    const { data, error } = await this.supabase.auth.getUser();
    if (error) {
      return null;
    }
    return data.user;
  }

  async refreshSessionIfNeeded(force = false): Promise<void> {
    const now = Date.now();
    const enoughTimeSinceLastAttempt =
      now - this.lastRefreshAttemptAt >= SupabaseService.MIN_REFRESH_INTERVAL_MS;

    if (!force && !enoughTimeSinceLastAttempt) {
      return;
    }

    const {
      data: { session },
      error,
    } = await this.supabase.auth.getSession();

    if (error || !session) {
      return;
    }

    const shouldRefresh =
      force ||
      session.expires_at === undefined ||
      session.expires_at === null ||
      session.expires_at - Math.floor(now / 1000) <= SupabaseService.TOKEN_REFRESH_LEAD_SECONDS;

    if (!shouldRefresh) {
      return;
    }

    this.lastRefreshAttemptAt = now;
    await this.supabase.auth.refreshSession();
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

  profileById(userId: string) {
    return this.supabase.from('profiles').select('username').eq('id', userId).maybeSingle();
  }

  cardById(cardId: string) {
    return this.supabase
      .from('cards')
      .select(
        `
          id,
          owner_id,
          title,
          created_at,
          current_version:card_versions!cards_current_version_id_fkey(
            character_name,
            creator_name,
            creator_notes,
            source_format
          ),
          avatar_file:card_files!cards_avatar_file_id_fkey(
            storage_path
          ),
          tags:card_tags(
            tag:tags(
              name,
              slug
            )
          )
        `,
      )
      .eq('id', cardId)
      .maybeSingle<CardDetailRecord>();
  }

  publicCards(limit = 40) {
    return this.supabase
      .from('cards')
      .select(
        `
          id,
          owner_id,
          title,
          tagline,
          created_at,
          current_version:card_versions!cards_current_version_id_fkey(
            character_name
          ),
          avatar_file:card_files!cards_avatar_file_id_fkey(
            storage_path
          ),
          tags:card_tags(
            tag:tags(
              name,
              slug
            )
          )
        `,
      )
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .limit(limit)
      .returns<CardListRecord[]>();
  }

  publicCardsPage(page: number, pageSize: number) {
    const safePage = Math.max(1, Math.trunc(page));
    const safePageSize = Math.max(1, Math.trunc(pageSize));
    const from = (safePage - 1) * safePageSize;
    const to = from + safePageSize - 1;

    return this.supabase
      .from('cards')
      .select(
        `
          id,
          owner_id,
          title,
          tagline,
          created_at,
          current_version:card_versions!cards_current_version_id_fkey(
            character_name
          ),
          avatar_file:card_files!cards_avatar_file_id_fkey(
            storage_path
          ),
          tags:card_tags(
            tag:tags(
              name,
              slug
            )
          )
        `,
        { count: 'exact' },
      )
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .range(from, to)
      .returns<CardListRecord[]>();
  }

  profilesByIds(userIds: readonly string[]) {
    return this.supabase.from('profiles').select('id, username').in('id', userIds);
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

  downloadImage(path: string) {
    return this.supabase.storage.from('profile-avatars').download(path);
  }

  uploadAvatar(filePath: string, file: File) {
    return this.supabase.storage.from('profile-avatars').upload(filePath, file);
  }

  createCardFileSignedUrl(path: string, expiresInSeconds = 3600) {
    return this.supabase.storage.from('card-files').createSignedUrl(path, expiresInSeconds);
  }
}
