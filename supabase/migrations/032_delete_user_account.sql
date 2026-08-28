-- RPC: delete_user_account
-- Deletes all data for the calling user, then removes the auth user.
-- SECURITY DEFINER so it can bypass RLS and delete from auth.users.

create or replace function delete_user_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  -- Remove from all groups/communities
  delete from conversation_members where user_id = v_uid;

  -- Delete messages sent by user
  delete from messages where sender_id = v_uid;

  -- Delete conversations owned/created by user (1:1 DMs where they're the creator)
  -- Groups/communities they created: transfer or leave as orphan (admins can clean up)
  -- We only delete direct DMs to avoid breaking active communities
  delete from conversations
  where id in (
    select id from conversations
    where is_group = false
    and id in (
      select conversation_id from conversation_members where user_id = v_uid
    )
  );

  -- Delete stories
  delete from stories where user_id = v_uid;

  -- Delete reactions
  delete from reactions where user_id = v_uid;

  -- Delete contacts
  delete from contacts where user_id = v_uid or contact_id = v_uid;

  -- Delete blocks
  delete from blocks where blocker_id = v_uid or blocked_id = v_uid;

  -- Delete push subscriptions
  delete from push_subscriptions where user_id = v_uid;

  -- Delete bot tokens
  delete from bot_tokens where user_id = v_uid;

  -- Delete reports
  delete from reports where reporter_id = v_uid;

  -- Delete user profile
  delete from users where id = v_uid;

  -- Finally delete the auth user
  delete from auth.users where id = v_uid;
end;
$$;

-- Only callable by authenticated users (RLS on the function via security definer + auth.uid() check)
revoke all on function delete_user_account() from public;
grant execute on function delete_user_account() to authenticated;

comment on function delete_user_account is
  'Permanently deletes all data for the authenticated user. Irreversible.';
