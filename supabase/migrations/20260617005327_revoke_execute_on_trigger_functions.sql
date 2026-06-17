-- Removes the default PUBLIC execute grant from internal trigger / event-trigger
-- functions so they no longer appear as callable endpoints to the anon and
-- authenticated roles (flagged by the 0028/0029 database linters).
--
-- These functions only ever run as part of a trigger or event trigger. Trigger
-- invocation does not check the caller's EXECUTE privilege, so revoking it has
-- no effect on normal operation -- it only closes the unused RPC surface.

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
revoke execute on function public.set_card_comment_depth() from public, anon, authenticated;
revoke execute on function public.sync_card_comment_count() from public, anon, authenticated;
revoke execute on function public.sync_card_like_count() from public, anon, authenticated;
