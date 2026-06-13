-- Returns whether the currently authenticated user has a password set.
-- Magic-link / OTP-only users have no password, so the client uses this to
-- decide between "Create password" and "Update password" flows.
--
-- SECURITY DEFINER is required to read auth.users, but the function only ever
-- reports on the caller's own row (auth.uid()), so it cannot leak other users'
-- data. Execute is restricted to authenticated users.
create or replace function public.current_user_has_password()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select encrypted_password is not null and encrypted_password <> ''
      from auth.users
      where id = (select auth.uid())
    ),
    false
  );
$$;

revoke execute on function public.current_user_has_password() from public, anon;
grant execute on function public.current_user_has_password() to authenticated;
