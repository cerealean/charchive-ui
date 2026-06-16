import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { SafeResourceUrl, DomSanitizer } from '@angular/platform-browser';
import { ProfileService } from '../../services/profile';

@Component({
  selector: 'app-avatar',
  templateUrl: './avatar.html',
  styleUrls: ['./avatar.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvatarComponent {
  _avatarUrl: SafeResourceUrl | undefined;
  private avatarObjectUrl: string | null = null;
  uploading = false;
  errorMessage = '';
  readonly fileInputId = `avatar-upload-${Math.random().toString(36).slice(2, 10)}`;

  @Input()
  set avatarUrl(url: string | null) {
    if (url) {
      this.downloadImage(url);
      return;
    }

    this.revokeAvatarObjectUrl();
    this._avatarUrl = undefined;
    this.detectChangesSafely();
  }

  @Output() upload = new EventEmitter<string>();

  constructor(
    private readonly profiles: ProfileService,
    private readonly dom: DomSanitizer,
    private readonly cdr: ChangeDetectorRef,
    private readonly destroyRef: DestroyRef,
  ) {
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
        this._avatarUrl = this.dom.bypassSecurityTrustResourceUrl(this.avatarObjectUrl);
        this.detectChangesSafely();
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error('Error downloading image: ', error.message);
      }
    }
  }

  async uploadAvatar(event: Event) {
    this.errorMessage = '';

    try {
      this.uploading = true;
      const target = event.target as HTMLInputElement | null;
      const file = target?.files?.item(0);

      if (!file) {
        throw new Error('You must select an image to upload.');
      }

      const fileExt = this.resolveFileExtension(file);
      const filePath = `${crypto.randomUUID()}.${fileExt}`;

      const { error } = await this.profiles.uploadAvatar(filePath, file);
      if (error) {
        throw error;
      }

      this.upload.emit(filePath);
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Unable to upload your image.';
    } finally {
      this.uploading = false;
      this.detectChangesSafely();
    }
  }

  private detectChangesSafely(): void {
    if (!this.destroyRef.destroyed) {
      this.cdr.detectChanges();
    }
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
