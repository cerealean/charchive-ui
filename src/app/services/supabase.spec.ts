import { TestBed } from '@angular/core/testing';
import * as supabaseJs from '@supabase/supabase-js';
import { Mock, vi } from 'vitest';

import { SupabaseService } from './supabase';

describe('SupabaseService', () => {
  let service: SupabaseService;
  let fromSpy: Mock;
  let selectSpy: Mock;
  let eqSpy: Mock;
  let orderSpy: Mock;
  let limitSpy: Mock;
  let returnsSpy: Mock;

  beforeEach(() => {
    const queryBuilder = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
      returns: vi.fn(),
    };

    queryBuilder.select.mockReturnValue(queryBuilder);
    queryBuilder.eq.mockReturnValue(queryBuilder);
    queryBuilder.order.mockReturnValue(queryBuilder);
    queryBuilder.limit.mockReturnValue(queryBuilder);
    queryBuilder.returns.mockReturnValue({ data: [], error: null });

    const mockClient = {
      from: vi.fn().mockReturnValue(queryBuilder),
      auth: {},
      storage: {},
    };

    vi.spyOn(supabaseJs, 'createClient').mockReturnValue(
      mockClient as unknown as supabaseJs.SupabaseClient,
    );

    fromSpy = mockClient.from;
    selectSpy = queryBuilder.select;
    eqSpy = queryBuilder.eq;
    orderSpy = queryBuilder.order;
    limitSpy = queryBuilder.limit;
    returnsSpy = queryBuilder.returns;

    TestBed.configureTestingModule({});
    service = TestBed.inject(SupabaseService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('publicCards should only query public visibility', () => {
    service.publicCards(48);

    expect(fromSpy).toHaveBeenCalledWith('cards');
    expect(selectSpy).toHaveBeenCalled();
    expect(eqSpy).toHaveBeenCalledWith('visibility', 'public');
    expect(orderSpy).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(limitSpy).toHaveBeenCalledWith(48);
    expect(returnsSpy).toHaveBeenCalled();
  });
});
