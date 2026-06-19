import {
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
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
  host: {
    '(document:keydown.escape)': 'closeMenu()',
  },
})
export class App {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly user = signal<User | null>(null);
  protected readonly isLoggedIn = computed(() => this.user() !== null);
  protected readonly menuOpen = signal(false);

  private readonly menuToggleButton = viewChild<ElementRef<HTMLButtonElement>>('menuToggle');
  private readonly drawerMenu = viewChild<ElementRef<HTMLElement>>('drawerMenu');

  constructor() {
    void this.loadCurrentUser();

    const { data: authListener } = this.auth.authChanges((_event, session) => {
      const user = session?.user ?? null;

      this.user.set(user);
    });

    this.destroyRef.onDestroy(() => {
      authListener.subscription.unsubscribe();
    });

    effect(() => {
      if (this.menuOpen()) {
        this.drawerMenu()?.nativeElement.querySelector<HTMLElement>('a, button')?.focus();
      }
    });
  }

  private async loadCurrentUser(): Promise<void> {
    const user = await this.auth.getUser();

    this.user.set(user);
  }

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    if (!this.menuOpen()) {
      return;
    }

    this.menuOpen.set(false);
    this.menuToggleButton()?.nativeElement.focus();
  }

  protected navigateTo(path: string): void {
    this.closeMenu();
    void this.router.navigateByUrl(path);
  }

  protected async signOut(): Promise<void> {
    this.closeMenu();
    await this.auth.signOut();
    await this.router.navigateByUrl('/');
  }
}
