import { Component, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import { SafeResourceUrl, DomSanitizer } from '@angular/platform-browser';
import { ProfileService } from '../../services/profile';

@Component({
  selector: 'app-avatar',
  templateUrl: './avatar.html',
  styleUrls: ['./avatar.css'],
})
export class AvatarComponent {
  private readonly profiles = inject(ProfileService);
  private readonly dom = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);

  readonly avatarUrl = input<string | null>(null);
  readonly userId = input<string | null>(null);
  readonly upload = output<string>();

  protected readonly imageUrl = signal<SafeResourceUrl | undefined>(undefined);
  protected readonly uploading = signal(false);
  readonly errorMessage = signal('');
  readonly fileInputId = `avatar-upload-${Math.random().toString(36).slice(2, 10)}`;

  private avatarObjectUrl: string | null = null;

  constructor() {
    effect(() => {
      const path = this.avatarUrl();

      if (path) {
        this.downloadImage(path);
      } else {
        this.clearAvatar();
      }
    });

    this.destroyRef.onDestroy(() => {
      this.revokeAvatarObjectUrl();
    });
  }

  async downloadImage(path: string) {
    try {
      const { data } = await this.profiles.downloadImage(path);
      if (data instanceof Blob) {
        this.revokeAvatarObjectUrl();
        this.avatarObjectUrl = URL.createObjectURL(data);
        this.imageUrl.set(this.dom.bypassSecurityTrustResourceUrl(this.avatarObjectUrl));
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error('Error downloading image: ', error.message);
      }
    }
  }

  async uploadAvatar(event: Event) {
    this.errorMessage.set('');

    try {
      this.uploading.set(true);
      const target = event.target as HTMLInputElement | null;
      const file = target?.files?.item(0);

      if (!file) {
        throw new Error('You must select an image to upload.');
      }

      const userId = this.userId();
      if (!userId) {
        throw new Error('You must be signed in to upload an image.');
      }

      const previousPath = this.avatarUrl();
      const fileExt = this.resolveFileExtension(file);
      const filePath = `${userId}/${crypto.randomUUID()}.${fileExt}`;

      const { error } = await this.profiles.uploadAvatar(filePath, file);
      if (error) {
        throw error;
      }

      await this.removePreviousAvatar(previousPath, filePath);
      this.upload.emit(filePath);
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'Unable to upload your image.');
    } finally {
      this.uploading.set(false);
    }
  }

  private async removePreviousAvatar(previousPath: string | null, newPath: string): Promise<void> {
    if (!previousPath || previousPath === newPath) {
      return;
    }

    try {
      const { error } = await this.profiles.removeAvatar(previousPath);
      if (error) {
        console.error('Error removing previous avatar: ', error.message);
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error('Error removing previous avatar: ', error.message);
      }
    }
  }

  private clearAvatar(): void {
    this.revokeAvatarObjectUrl();
    this.imageUrl.set(undefined);
  }

  private revokeAvatarObjectUrl(): void {
    if (this.avatarObjectUrl) {
      URL.revokeObjectURL(this.avatarObjectUrl);
      this.avatarObjectUrl = null;
    }
  }

  private resolveFileExtension(file: File): string {
    const extensionFromName = file.name.split('.').pop()?.toLowerCase();

    if (extensionFromName && /^[a-z0-9]+$/.test(extensionFromName)) {
      return extensionFromName;
    }

    const extensionByMimeType: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'image/svg+xml': 'svg',
      'image/avif': 'avif',
    };

    return extensionByMimeType[file.type] ?? 'bin';
  }
}
