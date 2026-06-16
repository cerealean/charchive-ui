-- Changes comment deletion so a thread is never broken. Deleting a comment that
-- has replies soft-deletes it (a tombstone shown as "This comment has been
-- deleted"), preserving the replies. Deleting a leaf comment hard-deletes it, and
-- any now-childless tombstone ancestors are cleaned up. All deletion goes through
-- the delete_card_comment() RPC so clients can no longer hard-delete a comment
-- that has replies (which would cascade and destroy the thread).

alter table public.card_comments
	add column if not exists deleted_at timestamp with time zone null;

-- comment_count tracks non-deleted comments only, so it must react to soft-deletes
-- (an UPDATE that sets deleted_at) and must not double-count when a tombstone row
-- is later hard-deleted during cleanup.
create or replace function public.sync_card_comment_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
	if tg_op = 'INSERT' then
		update public.cards
			set comment_count = comment_count + 1
			where id = new.card_id;
		return new;
	elsif tg_op = 'DELETE' then
		if old.deleted_at is null then
			update public.cards
				set comment_count = greatest(comment_count - 1, 0)
				where id = old.card_id;
		end if;
		return old;
	elsif tg_op = 'UPDATE' then
		if old.deleted_at is null and new.deleted_at is not null then
			update public.cards
				set comment_count = greatest(comment_count - 1, 0)
				where id = new.card_id;
		elsif old.deleted_at is not null and new.deleted_at is null then
			update public.cards
				set comment_count = comment_count + 1
				where id = new.card_id;
		end if;
		return new;
	end if;

	return null;
end;
$$;

drop trigger if exists card_comments_sync_count_update on public.card_comments;
create trigger card_comments_sync_count_update
	after update on public.card_comments
	for each row
	execute function public.sync_card_comment_count();

-- Authoritative deletion entry point. Soft-deletes comments that have replies,
-- hard-deletes leaves, and prunes childless tombstone ancestors. SECURITY DEFINER
-- so it can update deleted_at / delete rows despite the tightened table grants;
-- it enforces author ownership itself. Returns the action taken and any rows that
-- were physically removed so the client can update its view precisely.
create or replace function public.delete_card_comment(p_comment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
	v_author uuid;
	v_parent uuid;
	v_deleted_at timestamp with time zone;
	v_has_children boolean;
	v_removed uuid[] := array[]::uuid[];
	v_current uuid;
	v_current_parent uuid;
	v_current_deleted timestamp with time zone;
begin
	select author_id, parent_comment_id, deleted_at
		into v_author, v_parent, v_deleted_at
		from public.card_comments
		where id = p_comment_id;

	if not found then
		return jsonb_build_object('action', 'none', 'removed_ids', to_jsonb(v_removed));
	end if;

	if v_author <> auth.uid() then
		raise exception 'You can only delete your own comments.'
			using errcode = 'insufficient_privilege';
	end if;

	if v_deleted_at is not null then
		return jsonb_build_object('action', 'soft', 'removed_ids', to_jsonb(v_removed));
	end if;

	select exists(
		select 1 from public.card_comments where parent_comment_id = p_comment_id
	) into v_has_children;

	if v_has_children then
		update public.card_comments
			set deleted_at = now(),
				body = 'This comment has been deleted.'
			where id = p_comment_id;
		return jsonb_build_object('action', 'soft', 'removed_ids', to_jsonb(v_removed));
	end if;

	-- Leaf: hard-delete, then walk up removing tombstone ancestors that no longer
	-- have any children.
	delete from public.card_comments where id = p_comment_id;
	v_removed := array_append(v_removed, p_comment_id);

	v_current := v_parent;
	while v_current is not null loop
		select parent_comment_id, deleted_at
			into v_current_parent, v_current_deleted
			from public.card_comments
			where id = v_current;

		exit when not found;

		if v_current_deleted is not null
			and not exists(
				select 1 from public.card_comments where parent_comment_id = v_current
			)
		then
			delete from public.card_comments where id = v_current;
			v_removed := array_append(v_removed, v_current);
			v_current := v_current_parent;
		else
			exit;
		end if;
	end loop;

	return jsonb_build_object('action', 'hard', 'removed_ids', to_jsonb(v_removed));
end;
$$;

-- Force all deletion through the RPC: drop the direct DELETE policy and privilege
-- so a comment with replies can no longer be hard-deleted (which would cascade).
drop policy if exists "Users can delete their own comments" on public.card_comments;
revoke delete on public.card_comments from authenticated;
grant execute on function public.delete_card_comment(uuid) to authenticated;
