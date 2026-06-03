import { Component, EventEmitter, Input, Output } from '@angular/core';
import { SafeResourceUrl, DomSanitizer } from '@angular/platform-browser';
import { SupabaseService } from '../services/supabase';

@Component({
  selector: 'app-avatar',
  templateUrl: './avatar.html',
  styleUrls: ['./avatar.css'],
  standalone: true,
})
export class AvatarComponent {
  _avatarUrl: SafeResourceUrl | undefined;
  uploading = false;
  errorMessage = '';
  readonly fileInputId = `avatar-upload-${Math.random().toString(36).slice(2, 10)}`;

  @Input()
  set avatarUrl(url: string | null) {
    if (url) {
      this.downloadImage(url);
      return;
    }

    this._avatarUrl = undefined;
  }

  @Output() upload = new EventEmitter<string>();

  constructor(
    private readonly supabase: SupabaseService,
    private readonly dom: DomSanitizer,
  ) {}

  async downloadImage(path: string) {
    try {
      const { data } = await this.supabase.downLoadImage(path);
      if (data instanceof Blob) {
        this._avatarUrl = this.dom.bypassSecurityTrustResourceUrl(URL.createObjectURL(data));
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

      const fileExt = file.name.split('.').pop();
      const filePath = `${Math.random()}.${fileExt}`;

      await this.supabase.uploadAvatar(filePath, file);
      this.upload.emit(filePath);
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Unable to upload your image.';
    } finally {
      this.uploading = false;
    }
  }
}
