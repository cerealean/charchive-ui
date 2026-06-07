import { Component, DestroyRef, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { User } from '@supabase/supabase-js';
import { SupabaseService } from './services/supabase';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private static readonly SESSION_ACTIVITY_REFRESH_INTERVAL_MS = 60_000;

  private readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);

  private keepAliveIntervalId: number | null = null;
  private lastActivityRefreshAt = 0;

  protected readonly user = signal<User | null>(null);
  protected readonly isLoggedIn = computed(() => this.user() !== null);

  constructor() {
    void this.loadCurrentUser();

    const { data: authListener } = this.supabase.authChanges((_event, session) => {
      const user = session?.user ?? null;

      this.user.set(user);
    });

    this.setupSessionKeepAlive();

    this.destroyRef.onDestroy(() => {
      authListener.subscription.unsubscribe();

      if (this.keepAliveIntervalId !== null) {
        window.clearInterval(this.keepAliveIntervalId);
      }
    });
  }

  private async loadCurrentUser(): Promise<void> {
    const user = await this.supabase.getUser();

    this.user.set(user);
  }

  protected navigateTo(path: string): void {
    void this.router.navigateByUrl(path);
  }

  private setupSessionKeepAlive(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const refreshIfActive = () => {
      const now = Date.now();
      const enoughTimeSinceLastRefresh =
        now - this.lastActivityRefreshAt >= App.SESSION_ACTIVITY_REFRESH_INTERVAL_MS;

      if (!enoughTimeSinceLastRefresh) {
        return;
      }

      this.lastActivityRefreshAt = now;
      void this.supabase.refreshSessionIfNeeded();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshIfActive();
      }
    };

    window.addEventListener('pointerdown', refreshIfActive, { passive: true });
    window.addEventListener('keydown', refreshIfActive, { passive: true });
    document.addEventListener('visibilitychange', onVisibilityChange);

    this.keepAliveIntervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void this.supabase.refreshSessionIfNeeded();
      }
    }, App.SESSION_ACTIVITY_REFRESH_INTERVAL_MS);

    this.destroyRef.onDestroy(() => {
      window.removeEventListener('pointerdown', refreshIfActive);
      window.removeEventListener('keydown', refreshIfActive);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    });
  }
}
