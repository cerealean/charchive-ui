import { TestBed } from '@angular/core/testing';
import { Mock, vi } from 'vitest';

import type { SupabaseService as SupabaseServiceType } from './supabase';

const { createClientMock, mockClient } = vi.hoisted(() => {
  const createClientMock = vi.fn();
  const mockClient = {
    from: vi.fn(),
    auth: {},
    storage: {},
  };

  return {
    createClientMock,
    mockClient,
  };
});

vi.mock('@supabase/supabase-js', async () => {
  return {
    createClient: createClientMock,
  };
});

describe('SupabaseService', () => {
  let service: SupabaseServiceType;
  let createClientSpy: Mock;

  beforeEach(async () => {
    // Re-import the service against a fresh module graph so the hoisted
    // @supabase/supabase-js mock always binds, even when another spec file in
    // the shared test context imported the real module first.
    vi.resetModules();
    vi.clearAllMocks();
    createClientMock.mockReturnValue(mockClient);
    createClientSpy = createClientMock;

    const { SupabaseService } = await import('./supabase');
    TestBed.configureTestingModule({ providers: [SupabaseService] });
    service = TestBed.inject(SupabaseService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('creates the Supabase client once and exposes it', () => {
    expect(createClientSpy).toHaveBeenCalledTimes(1);
    expect(service.client).toBe(mockClient);
  });
});
