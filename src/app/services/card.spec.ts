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
  let inSpy: Mock;
  let ilikeSpy: Mock;
  let limitSpy: Mock;
  let rpcSpy: Mock;

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
      in: vi.fn(),
      ilike: vi.fn(),
      limit: vi.fn(),
    };

    queryBuilder.select.mockReturnValue(queryBuilder);
    queryBuilder.eq.mockReturnValue(queryBuilder);
    queryBuilder.order.mockReturnValue(queryBuilder);
    queryBuilder.range.mockReturnValue(queryBuilder);
    queryBuilder.returns.mockReturnValue({ data: [], error: null });
    queryBuilder.upsert.mockReturnValue({ data: null, error: null });
    queryBuilder.delete.mockReturnValue(queryBuilder);
    queryBuilder.maybeSingle.mockResolvedValue({ data: null, error: null });
    queryBuilder.in.mockReturnValue(queryBuilder);
    queryBuilder.ilike.mockReturnValue(queryBuilder);
    queryBuilder.limit.mockReturnValue(queryBuilder);

    const client = {
      from: vi.fn().mockReturnValue(queryBuilder),
      rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
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
    inSpy = queryBuilder.in;
    ilikeSpy = queryBuilder.ilike;
    limitSpy = queryBuilder.limit;
    rpcSpy = client.rpc;

    TestBed.configureTestingModule({
      providers: [{ provide: SupabaseService, useValue: { client } }],
    });

    service = TestBed.inject(CardService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('publicCardsByOwner filters by owner and non-private visibility, newest first', () => {
    service.publicCardsByOwner('owner-1');

    expect(fromSpy).toHaveBeenCalledWith('cards');
    expect(eqSpy).toHaveBeenCalledWith('owner_id', 'owner-1');
    expect(inSpy).toHaveBeenCalledWith('visibility', ['public', 'unlisted']);
    expect(orderSpy).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(returnsSpy).toHaveBeenCalled();
  });

  it('searchTags queries tags ordered by popularity then name, capped by limit', () => {
    service.searchTags('hero', 5);

    expect(fromSpy).toHaveBeenCalledWith('tags');
    expect(selectSpy).toHaveBeenCalledWith('id, name, slug, public_card_count');
    expect(ilikeSpy).toHaveBeenCalledWith('name', '%hero%');
    expect(orderSpy).toHaveBeenCalledWith('public_card_count', { ascending: false });
    expect(orderSpy).toHaveBeenCalledWith('name', { ascending: true });
    expect(limitSpy).toHaveBeenCalledWith(5);
    expect(returnsSpy).toHaveBeenCalled();
  });

  it('searchPublicCardsPage calls the RPC with paged offset and tag/title filters', async () => {
    await service.searchPublicCardsPage({
      page: 3,
      pageSize: 10,
      search: '  knight  ',
      includeTagIds: ['tag-a', 'tag-b'],
      excludeTagIds: ['tag-c'],
    });

    expect(rpcSpy).toHaveBeenCalledWith('search_public_cards', {
      p_search: 'knight',
      p_include_tag_ids: ['tag-a', 'tag-b'],
      p_exclude_tag_ids: ['tag-c'],
      p_limit: 10,
      p_offset: 20,
    });
  });

  it('searchPublicCardsPage sends a null title when the search is blank', async () => {
    await service.searchPublicCardsPage({ page: 1, pageSize: 20, search: '   ' });

    expect(rpcSpy).toHaveBeenCalledWith('search_public_cards', {
      p_search: null,
      p_include_tag_ids: [],
      p_exclude_tag_ids: [],
      p_limit: 20,
      p_offset: 0,
    });
  });

  it('searchPublicCardsPage returns an empty array when the RPC yields no data', async () => {
    rpcSpy.mockResolvedValueOnce({ data: null, error: null });

    const result = await service.searchPublicCardsPage({ page: 1, pageSize: 10 });

    expect(result.data).toEqual([]);
    expect(result.error).toBeNull();
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

  it('likedCardIds returns the set of cards the user has liked', async () => {
    inSpy.mockResolvedValueOnce({
      data: [{ card_id: 'card-1' }, { card_id: 'card-3' }],
      error: null,
    });

    const liked = await service.likedCardIds(['card-1', 'card-2', 'card-3'], 'user-1');

    expect(fromSpy).toHaveBeenCalledWith('card_likes');
    expect(eqSpy).toHaveBeenCalledWith('user_id', 'user-1');
    expect(inSpy).toHaveBeenCalledWith('card_id', ['card-1', 'card-2', 'card-3']);
    expect(liked).toEqual(new Set(['card-1', 'card-3']));
  });

  it('likedCardIds short-circuits without querying when no card ids are given', async () => {
    const liked = await service.likedCardIds([], 'user-1');

    expect(liked.size).toBe(0);
    expect(inSpy).not.toHaveBeenCalled();
  });

  it('likedCardIds rejects when the query errors', async () => {
    const queryError = new Error('boom');
    inSpy.mockResolvedValueOnce({ data: null, error: queryError });

    await expect(service.likedCardIds(['card-1'], 'user-1')).rejects.toBe(queryError);
  });

  it('likeComment upserts the like keyed on the comment/user pair', () => {
    service.likeComment('comment-1', 'user-1');

    expect(fromSpy).toHaveBeenCalledWith('card_comment_likes');
    expect(upsertSpy).toHaveBeenCalledWith(
      { comment_id: 'comment-1', user_id: 'user-1' },
      { onConflict: 'comment_id,user_id', ignoreDuplicates: true },
    );
  });

  it('unlikeComment deletes the matching like row', () => {
    service.unlikeComment('comment-1', 'user-1');

    expect(fromSpy).toHaveBeenCalledWith('card_comment_likes');
    expect(deleteSpy).toHaveBeenCalled();
    expect(eqSpy).toHaveBeenCalledWith('comment_id', 'comment-1');
    expect(eqSpy).toHaveBeenCalledWith('user_id', 'user-1');
  });

  it('likedCommentIds returns the set of comments the user has liked', async () => {
    inSpy.mockResolvedValueOnce({
      data: [{ comment_id: 'comment-1' }, { comment_id: 'comment-3' }],
      error: null,
    });

    const liked = await service.likedCommentIds(
      ['comment-1', 'comment-2', 'comment-3'],
      'user-1',
    );

    expect(fromSpy).toHaveBeenCalledWith('card_comment_likes');
    expect(eqSpy).toHaveBeenCalledWith('user_id', 'user-1');
    expect(inSpy).toHaveBeenCalledWith('comment_id', ['comment-1', 'comment-2', 'comment-3']);
    expect(liked).toEqual(new Set(['comment-1', 'comment-3']));
  });

  it('likedCommentIds short-circuits without querying when no comment ids are given', async () => {
    const liked = await service.likedCommentIds([], 'user-1');

    expect(liked.size).toBe(0);
    expect(inSpy).not.toHaveBeenCalled();
  });

  it('likedCommentIds rejects when the query errors', async () => {
    const queryError = new Error('boom');
    inSpy.mockResolvedValueOnce({ data: null, error: queryError });

    await expect(service.likedCommentIds(['comment-1'], 'user-1')).rejects.toBe(queryError);
  });
});
