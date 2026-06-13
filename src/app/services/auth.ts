import { Injectable, inject } from '@angular/core';
import { AuthChangeEvent, Session, User } from '@supabase/supabase-js';

import { SupabaseService } from './supabase';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly supabase = inject(SupabaseService);

  async getUser(): Promise<User | null> {
    const {
      data: { session },
    } = await this.supabase.client.auth.getSession();

    if (session?.user) {
      return session.user;
    }

    const { data, error } = await this.supabase.client.auth.getUser();

    if (error) {
      return null;
    }

    return data.user;
  }

  authChanges(callback: (event: AuthChangeEvent, session: Session | null) => void) {
    return this.supabase.client.auth.onAuthStateChange(callback);
  }

  signIn(email: string) {
    return this.supabase.client.auth.signInWithOtp({ email });
  }

  signInWithPassword(email: string, password: string) {
    return this.supabase.client.auth.signInWithPassword({ email, password });
  }

  signUp(email: string, password: string) {
    return this.supabase.client.auth.signUp({ email, password });
  }

  resendConfirmation(email: string) {
    return this.supabase.client.auth.resend({ type: 'signup', email });
  }

  resetPassword(email: string, redirectTo?: string) {
    return this.supabase.client.auth.resetPasswordForEmail(
      email,
      redirectTo ? { redirectTo } : undefined,
    );
  }

  updatePassword(password: string) {
    return this.supabase.client.auth.updateUser({ password });
  }

  signOut() {
    return this.supabase.client.auth.signOut({ scope: 'local' });
  }
}
