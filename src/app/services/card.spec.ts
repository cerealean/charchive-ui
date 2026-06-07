import { TestBed } from '@angular/core/testing';
import { Mock, vi } from 'vitest';

import { CardService } from './card';
import { SupabaseService } from './supabase';

describe('CardService', () => {
  let service: CardService;
  let fromSpy: Mock;
  let selectSpy: Mock;
  let eqSpy: Mock;
  let orderSpy: Mock;
  let rangeSpy: Mock;
  let returnsSpy: Mock;

  beforeEach(() => {
    const queryBuilder = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      range: vi.fn(),
      returns: vi.fn(),
    };

    queryBuilder.select.mockReturnValue(queryBuilder);
    queryBuilder.eq.mockReturnValue(queryBuilder);
    queryBuilder.order.mockReturnValue(queryBuilder);
    queryBuilder.range.mockReturnValue(queryBuilder);
    queryBuilder.returns.mockReturnValue({ data: [], error: null });

    const client = {
      from: vi.fn().mockReturnValue(queryBuilder),
      storage: {
        from: vi.fn(),
      },
      auth: {},
    };

    fromSpy = client.from;
    selectSpy = queryBuilder.select;
    eqSpy = queryBuilder.eq;
    orderSpy = queryBuilder.order;
    rangeSpy = queryBuilder.range;
    returnsSpy = queryBuilder.returns;

    TestBed.configureTestingModule({
      providers: [{ provide: SupabaseService, useValue: { client } }],
    });

    service = TestBed.inject(CardService);
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
