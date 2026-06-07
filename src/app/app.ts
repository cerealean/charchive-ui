import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
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
  private readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly user = signal<User | null>(null);
  protected readonly isLoggedIn = computed(() => this.user() !== null);

  constructor() {
    void this.loadCurrentUser();

    const { data: authListener } = this.supabase.authChanges((_event, session) => {
      const user = session?.user ?? null;

      this.user.set(user);
      void this.syncUsernameRoute(user);
    });

    this.destroyRef.onDestroy(() => {
      authListener.subscription.unsubscribe();
    });
  }

  private async loadCurrentUser(): Promise<void> {
    const user = await this.supabase.getUser();

    this.user.set(user);
    await this.syncUsernameRoute(user);
  }

  protected navigateTo(path: string): void {
    void this.router.navigateByUrl(path);
  }

  private async syncUsernameRoute(user: User | null): Promise<void> {
    if (!user) {
      return;
    }

    const hasUsername = await this.supabase.userHasUsername(user);
    const isUsernameSetupRoute = this.router.url === '/my/username';

    if (!hasUsername && !isUsernameSetupRoute) {
      await this.router.navigateByUrl('/my/username', { replaceUrl: true });
    }

    if (hasUsername && isUsernameSetupRoute) {
      await this.router.navigateByUrl('/my/cards', { replaceUrl: true });
    }
  }
}
