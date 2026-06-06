import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AvatarComponent } from './avatar';
import { SupabaseService } from '../../services/supabase';

describe('AvatarComponent', () => {
  let component: AvatarComponent;
  let fixture: ComponentFixture<AvatarComponent>;

  const supabaseServiceMock = {
    downLoadImage: async () => ({ data: null, error: null }),
    uploadAvatar: async () => ({ data: null, error: null }),
  } as unknown as SupabaseService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AvatarComponent],
      providers: [{ provide: SupabaseService, useValue: supabaseServiceMock }],
    }).compileComponents();

    fixture = TestBed.createComponent(AvatarComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
