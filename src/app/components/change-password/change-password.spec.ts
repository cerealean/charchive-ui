import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { ChangePasswordComponent } from './change-password';
import { AuthService } from '../../services/auth';

describe('ChangePasswordComponent', () => {
  let component: ChangePasswordComponent;
  let fixture: ComponentFixture<ChangePasswordComponent>;
  let updateCalls: string[] = [];
  let verifyCalls: { email: string; password: string }[] = [];
  let verifyResult = true;
  let updateError: Error | null = null;
  let savedEvents: boolean[] = [];

  const authServiceMock = {
    updatePassword: async (password: string) => {
      updateCalls.push(password);
      return { data: { user: null }, error: updateError };
    },
    verifyPassword: async (email: string, password: string) => {
      verifyCalls.push({ email, password });
      return verifyResult;
    },
  } as unknown as AuthService;

  beforeEach(async () => {
    updateCalls = [];
    verifyCalls = [];
    verifyResult = true;
    updateError = null;
    savedEvents = [];

    HTMLDialogElement.prototype.showModal = vi.fn();
    HTMLDialogElement.prototype.close = vi.fn();

    await TestBed.configureTestingModule({
      imports: [ChangePasswordComponent],
      providers: [{ provide: AuthService, useValue: authServiceMock }],
    }).compileComponents();

    fixture = TestBed.createComponent(ChangePasswordComponent);
    component = fixture.componentInstance;
    component.saved.subscribe((created) => savedEvents.push(created));
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('does not require a current password in create mode and creates a password', async () => {
    fixture.componentRef.setInput('hasPassword', false);
    component.open();
    component.passwordControl.setValue('Str0ng!Pass');
    component.confirmControl.setValue('Str0ng!Pass');

    await component.submit();

    expect(verifyCalls.length).toBe(0);
    expect(updateCalls).toEqual(['Str0ng!Pass']);
    expect(savedEvents).toEqual([true]);
  });

  it('rejects a password that does not meet the strength requirements', async () => {
    fixture.componentRef.setInput('hasPassword', false);
    component.open();
    component.passwordControl.setValue('weak');
    component.confirmControl.setValue('weak');

    await component.submit();

    expect(updateCalls.length).toBe(0);
    expect(component.passwordControl.hasError('passwordStrength')).toBe(true);
  });

  it('requires the current password in update mode', async () => {
    fixture.componentRef.setInput('hasPassword', true);
    component.open();
    component.passwordControl.setValue('Str0ng!Pass');
    component.confirmControl.setValue('Str0ng!Pass');

    await component.submit();

    expect(updateCalls.length).toBe(0);
    expect(component.currentPasswordControl.hasError('required')).toBe(true);
  });

  it('verifies the current password then updates in update mode', async () => {
    fixture.componentRef.setInput('hasPassword', true);
    fixture.componentRef.setInput('email', 'user@example.com');
    component.open();
    component.currentPasswordControl.setValue('old-pass');
    component.passwordControl.setValue('Str0ng!Pass');
    component.confirmControl.setValue('Str0ng!Pass');

    await component.submit();

    expect(verifyCalls).toEqual([{ email: 'user@example.com', password: 'old-pass' }]);
    expect(updateCalls).toEqual(['Str0ng!Pass']);
    expect(savedEvents).toEqual([false]);
  });

  it('blocks the update when the current password is incorrect', async () => {
    verifyResult = false;
    fixture.componentRef.setInput('hasPassword', true);
    fixture.componentRef.setInput('email', 'user@example.com');
    component.open();
    component.currentPasswordControl.setValue('wrong-pass');
    component.passwordControl.setValue('Str0ng!Pass');
    component.confirmControl.setValue('Str0ng!Pass');

    await component.submit();

    expect(updateCalls.length).toBe(0);
    expect(component.errorMessage()).toContain('current password is incorrect');
    expect(savedEvents).toEqual([]);
  });

  it('surfaces an error when the update fails', async () => {
    updateError = new Error('New password should be different from the old password.');
    fixture.componentRef.setInput('hasPassword', false);
    component.open();
    component.passwordControl.setValue('Str0ng!Pass');
    component.confirmControl.setValue('Str0ng!Pass');

    await component.submit();

    expect(component.errorMessage()).toContain('different');
    expect(savedEvents).toEqual([]);
  });
});
