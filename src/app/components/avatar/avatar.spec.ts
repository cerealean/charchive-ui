import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AvatarComponent } from './avatar';
import { ProfileService } from '../../services/profile';

describe('AvatarComponent', () => {
  let component: AvatarComponent;
  let fixture: ComponentFixture<AvatarComponent>;

  const profileServiceMock = {
    downloadImage: async () => ({ data: null, error: null }),
    uploadAvatar: async () => ({ data: null, error: null }),
  } as unknown as ProfileService;

  beforeEach(async () => {
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
});
