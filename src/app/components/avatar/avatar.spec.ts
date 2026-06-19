import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AvatarComponent } from './avatar';
import { ProfileService } from '../../services/profile';

describe('AvatarComponent', () => {
  let component: AvatarComponent;
  let fixture: ComponentFixture<AvatarComponent>;

  let uploadResult: { data: unknown; error: unknown };
  let uploadedPaths: string[];
  let removedPaths: string[];

  const profileServiceMock = {
    downloadImage: async () => ({ data: null, error: null }),
    uploadAvatar: async (filePath: string) => {
      uploadedPaths.push(filePath);
      return uploadResult;
    },
    removeAvatar: async (path: string) => {
      removedPaths.push(path);
      return { data: [], error: null };
    },
  } as unknown as ProfileService;

  function buildFileChangeEvent(): Event {
    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });
    return {
      target: { files: { item: () => file } },
    } as unknown as Event;
  }

  beforeEach(async () => {
    uploadResult = { data: null, error: null };
    uploadedPaths = [];
    removedPaths = [];

    await TestBed.configureTestingModule({
      imports: [AvatarComponent],
      providers: [{ provide: ProfileService, useValue: profileServiceMock }],
    }).compileComponents();

    fixture = TestBed.createComponent(AvatarComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('uploads to the signed-in user folder and emits the path on success', async () => {
    fixture.componentRef.setInput('userId', 'user-1');
    const emitted: string[] = [];
    component.upload.subscribe((path) => emitted.push(path));

    await component.uploadAvatar(buildFileChangeEvent());

    expect(emitted.length).toBe(1);
    expect(emitted[0]).toMatch(/^user-1\/.+\.png$/);
    expect(uploadedPaths).toEqual(emitted);
    expect(component.errorMessage()).toBe('');
  });

  it('surfaces an error and does not emit when the upload fails', async () => {
    fixture.componentRef.setInput('userId', 'user-1');
    uploadResult = { data: null, error: new Error('Upload blocked by policy.') };
    const emitted: string[] = [];
    component.upload.subscribe((path) => emitted.push(path));

    await component.uploadAvatar(buildFileChangeEvent());

    expect(emitted.length).toBe(0);
    expect(component.errorMessage()).toBe('Upload blocked by policy.');
  });

  it('does not upload or emit when no user is signed in', async () => {
    fixture.componentRef.setInput('userId', null);
    const emitted: string[] = [];
    component.upload.subscribe((path) => emitted.push(path));

    await component.uploadAvatar(buildFileChangeEvent());

    expect(uploadedPaths.length).toBe(0);
    expect(emitted.length).toBe(0);
    expect(component.errorMessage()).toBe('You must be signed in to upload an image.');
  });

  it('removes the previous avatar after a successful replacement', async () => {
    fixture.componentRef.setInput('userId', 'user-1');
    fixture.componentRef.setInput('avatarUrl', 'user-1/old-avatar.png');

    await component.uploadAvatar(buildFileChangeEvent());

    expect(removedPaths).toEqual(['user-1/old-avatar.png']);
  });

  it('does not attempt removal when there is no existing avatar', async () => {
    fixture.componentRef.setInput('userId', 'user-1');
    fixture.componentRef.setInput('avatarUrl', null);

    await component.uploadAvatar(buildFileChangeEvent());

    expect(removedPaths.length).toBe(0);
  });
});
