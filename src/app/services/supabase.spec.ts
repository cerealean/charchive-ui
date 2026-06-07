import { TestBed } from '@angular/core/testing';
import { Mock, vi } from 'vitest';

import { SupabaseService } from './supabase';

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
  let service: SupabaseService;
  let createClientSpy: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    createClientMock.mockReturnValue(mockClient);
    createClientSpy = createClientMock;

    TestBed.configureTestingModule({});
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
