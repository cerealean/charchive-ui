import {
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { User } from '@supabase/supabase-js';
import { AuthService } from './services/auth';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './app.css',
})
export class App {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly user = signal<User | null>(null);
  protected readonly isLoggedIn = computed(() => this.user() !== null);

  constructor() {
    void this.loadCurrentUser();

    const { data: authListener } = this.auth.authChanges((_event, session) => {
      const user = session?.user ?? null;

      this.user.set(user);
    });

    this.destroyRef.onDestroy(() => {
      authListener.subscription.unsubscribe();
    });
  }

  private async loadCurrentUser(): Promise<void> {
    const user = await this.auth.getUser();

    this.user.set(user);
  }

  protected navigateTo(path: string): void {
    void this.router.navigateByUrl(path);
  }

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/');
  }
}
