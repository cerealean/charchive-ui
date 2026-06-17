-- Removes the default PUBLIC execute grant from sync_card_comment_like_count,
-- the trigger function added with the comment-like feature. Like the other
-- trigger functions (see revoke_execute_on_trigger_functions), it only ever
-- runs as part of a trigger -- which does not check the caller's EXECUTE
-- privilege -- so revoking it closes the unused RPC surface flagged by the
-- 0028/0029 linters without affecting trigger behavior.

revoke execute on function public.sync_card_comment_like_count() from public, anon, authenticated;
