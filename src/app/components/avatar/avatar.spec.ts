import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AvatarComponent } from './avatar';
import { ProfileService } from '../../services/profile';

describe('AvatarComponent', () => {
  let component: AvatarComponent;
  let fixture: ComponentFixture<AvatarComponent>;

  let uploadResult: { data: unknown; error: unknown };

  const profileServiceMock = {
    downloadImage: async () => ({ data: null, error: null }),
    uploadAvatar: async () => uploadResult,
  } as unknown as ProfileService;

  function buildFileChangeEvent(): Event {
    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });
    return {
      target: { files: { item: () => file } },
    } as unknown as Event;
  }

  beforeEach(async () => {
    uploadResult = { data: null, error: null };

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

  it('emits the uploaded file path when the upload succeeds', async () => {
    const emitted: string[] = [];
    component.upload.subscribe((path) => emitted.push(path));

    await component.uploadAvatar(buildFileChangeEvent());

    expect(emitted.length).toBe(1);
    expect(emitted[0]).toMatch(/\.png$/);
    expect(component.errorMessage).toBe('');
  });

  it('surfaces an error and does not emit when the upload fails', async () => {
    uploadResult = { data: null, error: new Error('Upload blocked by policy.') };
    const emitted: string[] = [];
    component.upload.subscribe((path) => emitted.push(path));

    await component.uploadAvatar(buildFileChangeEvent());

    expect(emitted.length).toBe(0);
    expect(component.errorMessage).toBe('Upload blocked by policy.');
  });
});
