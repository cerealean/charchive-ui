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
  let upsertSpy: Mock;
  let deleteSpy: Mock;
  let maybeSingleSpy: Mock;

  beforeEach(() => {
    const queryBuilder = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      range: vi.fn(),
      returns: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      maybeSingle: vi.fn(),
    };

    queryBuilder.select.mockReturnValue(queryBuilder);
    queryBuilder.eq.mockReturnValue(queryBuilder);
    queryBuilder.order.mockReturnValue(queryBuilder);
    queryBuilder.range.mockReturnValue(queryBuilder);
    queryBuilder.returns.mockReturnValue({ data: [], error: null });
    queryBuilder.upsert.mockReturnValue({ data: null, error: null });
    queryBuilder.delete.mockReturnValue(queryBuilder);
    queryBuilder.maybeSingle.mockResolvedValue({ data: null, error: null });

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
    upsertSpy = queryBuilder.upsert;
    deleteSpy = queryBuilder.delete;
    maybeSingleSpy = queryBuilder.maybeSingle;

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

  it('userLikedCard returns true when a like row exists for the user', async () => {
    maybeSingleSpy.mockResolvedValueOnce({
      data: { card_id: 'card-1' },
      error: null,
    });

    const liked = await service.userLikedCard('card-1', 'user-1');

    expect(fromSpy).toHaveBeenCalledWith('card_likes');
    expect(eqSpy).toHaveBeenCalledWith('card_id', 'card-1');
    expect(eqSpy).toHaveBeenCalledWith('user_id', 'user-1');
    expect(liked).toBe(true);
  });

  it('userLikedCard returns false when no like row exists', async () => {
    maybeSingleSpy.mockResolvedValueOnce({ data: null, error: null });

    const liked = await service.userLikedCard('card-1', 'user-1');

    expect(liked).toBe(false);
  });

  it('userLikedCard rejects when the query errors', async () => {
    const queryError = new Error('boom');
    maybeSingleSpy.mockResolvedValueOnce({ data: null, error: queryError });

    await expect(service.userLikedCard('card-1', 'user-1')).rejects.toBe(queryError);
  });

  it('likeCard upserts the like keyed on the card/user pair', () => {
    service.likeCard('card-1', 'user-1');

    expect(fromSpy).toHaveBeenCalledWith('card_likes');
    expect(upsertSpy).toHaveBeenCalledWith(
      { card_id: 'card-1', user_id: 'user-1' },
      { onConflict: 'card_id,user_id', ignoreDuplicates: true },
    );
  });

  it('unlikeCard deletes the matching like row', () => {
    service.unlikeCard('card-1', 'user-1');

    expect(fromSpy).toHaveBeenCalledWith('card_likes');
    expect(deleteSpy).toHaveBeenCalled();
    expect(eqSpy).toHaveBeenCalledWith('card_id', 'card-1');
    expect(eqSpy).toHaveBeenCalledWith('user_id', 'user-1');
  });
});
