create or replace function public.register_push_subscription(
  p_user_id uuid,p_endpoint text,p_p256dh text,p_auth_secret text
) returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  if not exists (
    select 1 from public.users u join public.roles r on r.id=u.role_id
    where u.id=p_user_id and u.status='aktif' and lower(r.name)<>'spectator'
  ) then return false; end if;
  insert into public.push_subscriptions(user_id,endpoint,p256dh,auth_secret)
  values(p_user_id,p_endpoint,p_p256dh,p_auth_secret)
  on conflict(endpoint) do update
  set p256dh=excluded.p256dh,auth_secret=excluded.auth_secret,updated_at=now()
  where public.push_subscriptions.user_id=excluded.user_id
  returning id into v_id;
  return v_id is not null;
end;
$$;
revoke all on function public.register_push_subscription(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.register_push_subscription(uuid,text,text,text) to service_role;
