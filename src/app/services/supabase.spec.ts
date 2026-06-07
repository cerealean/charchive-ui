import { TestBed } from '@angular/core/testing';
import { Mock, vi } from 'vitest';

import { SupabaseService } from './supabase';

const { createClientMock, fromMock, queryBuilder } = vi.hoisted(() => {
  const queryBuilder = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
    returns: vi.fn(),
  };

  const fromMock = vi.fn();
  const createClientMock = vi.fn();

  return {
    createClientMock,
    fromMock,
    queryBuilder,
  };
});

vi.mock('@supabase/supabase-js', async () => {
  return {
    createClient: createClientMock,
  };
});

describe('SupabaseService', () => {
  let service: SupabaseService;
  let fromSpy: Mock;
  let selectSpy: Mock;
  let eqSpy: Mock;
  let orderSpy: Mock;
  let rangeSpy: Mock;
  let returnsSpy: Mock;

  beforeEach(() => {
    vi.clearAllMocks();

    queryBuilder.select.mockReturnValue(queryBuilder);
    queryBuilder.eq.mockReturnValue(queryBuilder);
    queryBuilder.order.mockReturnValue(queryBuilder);
    queryBuilder.range.mockReturnValue(queryBuilder);
    queryBuilder.returns.mockReturnValue({ data: [], error: null });

    const mockClient = {
      from: fromMock.mockReturnValue(queryBuilder),
      auth: {},
      storage: {},
    };

    createClientMock.mockReturnValue(mockClient);

    fromSpy = mockClient.from;
    selectSpy = queryBuilder.select;
    eqSpy = queryBuilder.eq;
    orderSpy = queryBuilder.order;
    rangeSpy = queryBuilder.range;
    returnsSpy = queryBuilder.returns;

    TestBed.configureTestingModule({});
    service = TestBed.inject(SupabaseService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('publicCardsPage should only query public visibility with pagination', () => {
    service.publicCardsPage(2, 10);

    expect(fromSpy).toHaveBeenCalledWith('cards');
    expect(selectSpy).toHaveBeenCalledWith(expect.any(String), { count: 'exact' });
    expect(eqSpy).toHaveBeenCalledWith('visibility', 'public');
    expect(orderSpy).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(rangeSpy).toHaveBeenCalledWith(10, 19);
    expect(returnsSpy).toHaveBeenCalled();
  });
});
