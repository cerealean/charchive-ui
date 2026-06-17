-- Hardens public.delete_card_comment against unauthenticated callers.
--
-- Two issues addressed:
--   1. The function inherited the default PUBLIC execute grant, so the `anon`
--      role could call it via /rest/v1/rpc/delete_card_comment.
--   2. The ownership guard used `v_author <> auth.uid()`. For an anon caller
--      auth.uid() is NULL, so the comparison yields NULL, the IF is treated as
--      false, and the guard was skipped entirely -- allowing deletion of any
--      comment. `is distinct from` is NULL-safe and treats a NULL caller as a
--      mismatch, raising the exception as intended.
--
-- The body is otherwise identical to the original definition.

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

	if v_author is distinct from auth.uid() then
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

-- Strip the default PUBLIC grant (which the anon role inherits) and re-grant
-- execute only to signed-in users.
revoke execute on function public.delete_card_comment(uuid) from public, anon;
grant execute on function public.delete_card_comment(uuid) to authenticated;
