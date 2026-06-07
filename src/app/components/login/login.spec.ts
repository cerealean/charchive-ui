import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { LoginComponent } from './login';
import { AuthService } from '../../services/auth';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let signInCalls = 0;
  let authService: Pick<AuthService, 'signIn'>;

  beforeEach(async () => {
    signInCalls = 0;
    authService = {
      signIn: async () => {
        signInCalls += 1;
        return {
          data: {
            user: null,
            session: null,
          },
          error: null,
        };
      },
    };

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows validation feedback after submitting an empty form', () => {
    fixture.detectChanges();

    component.onSubmit();
    fixture.detectChanges();

    const errorText = fixture.debugElement.query(By.css('#email-error'))?.nativeElement.textContent;

    expect(errorText).toContain('Email is required.');
    expect(signInCalls).toBe(0);
  });
});
