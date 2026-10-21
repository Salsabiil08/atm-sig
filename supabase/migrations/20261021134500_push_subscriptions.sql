-- Push endpoints are private. This migration is additive and does not modify existing notification rows.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_secret text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from public, anon, authenticated;
grant select,insert,update,delete on public.push_subscriptions to service_role;

create table if not exists public.push_deliveries (
  notification_id uuid not null references public.notifications(id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','processing','sent','failed')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  claimed_until timestamptz,
  claim_token uuid,
  delivered_at timestamptz,
  last_error text,
  primary key (notification_id,subscription_id)
);
create index if not exists push_deliveries_claim_idx
  on public.push_deliveries (next_attempt_at, claimed_until) where status in ('pending','processing');
alter table public.push_deliveries enable row level security;
revoke all on public.push_deliveries from public, anon, authenticated;
grant select,insert,update,delete on public.push_deliveries to service_role;

-- Enqueue only notifications inserted AFTER the user has opted in.
create or replace function public.enqueue_notification_push()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.push_deliveries(notification_id,subscription_id)
  select new.id,s.id from public.push_subscriptions s
  join public.users u on u.id=s.user_id
  join public.roles r on r.id=u.role_id
  where s.user_id=new.user_id and u.status='aktif' and lower(r.name)<>'spectator'
  on conflict do nothing;
  return new;
end;
$$;
revoke all on function public.enqueue_notification_push() from public, anon, authenticated;
drop trigger if exists enqueue_notification_push_trigger on public.notifications;
create trigger enqueue_notification_push_trigger
after insert on public.notifications for each row execute function public.enqueue_notification_push();

-- Row locks + leases make concurrent cron invocations claim distinct deliveries.
create or replace function public.claim_push_deliveries(p_batch_size integer default 50)
returns table(notification_id uuid,subscription_id uuid,claim_token uuid,endpoint text,p256dh text,auth_secret text)
language sql security definer set search_path = ''
as $$
  with candidates as (
    select d.notification_id,d.subscription_id
    from public.push_deliveries d
    join public.push_subscriptions s on s.id=d.subscription_id
    join public.users u on u.id=s.user_id
    join public.roles r on r.id=u.role_id
    where (d.status='pending' or (d.status='processing' and d.claimed_until<now()))
      and d.next_attempt_at<=now()
      and d.attempts<5
      and u.status='aktif'
      and lower(r.name)<>'spectator'
    order by d.next_attempt_at
    for update of d skip locked
    limit least(greatest(p_batch_size,1),100)
  ), claimed as (
    update public.push_deliveries d
    set status='processing',
        attempts=d.attempts+1,
        claim_token=gen_random_uuid(),
        claimed_until=now()+interval '3 minutes'
    from candidates c
    where d.notification_id=c.notification_id and d.subscription_id=c.subscription_id
    returning d.notification_id,d.subscription_id,d.claim_token
  )
  select c.notification_id,c.subscription_id,c.claim_token,s.endpoint,s.p256dh,s.auth_secret
  from claimed c join public.push_subscriptions s on s.id=c.subscription_id;
$$;
revoke all on function public.claim_push_deliveries(integer) from public, anon, authenticated;
grant execute on function public.claim_push_deliveries(integer) to service_role;

create or replace function public.finish_push_delivery(
  p_notification_id uuid,p_subscription_id uuid,p_claim_token uuid,
  p_success boolean,p_terminal boolean default false,p_error text default null
) returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_updated integer;
begin
  update public.push_deliveries d
  set status=case when p_success then 'sent' when p_terminal or d.attempts>=5 then 'failed' else 'pending' end,
      delivered_at=case when p_success then now() else d.delivered_at end,
      last_error=case when p_success then null else left(coalesce(p_error,'delivery failed'),500) end,
      claimed_until=null,
      claim_token=null,
      next_attempt_at=case when p_success or p_terminal or d.attempts>=5 then now()
        else now()+(least(power(2::numeric,d.attempts),60)::text||' minutes')::interval end
  where d.notification_id=p_notification_id and d.subscription_id=p_subscription_id
    and d.claim_token=p_claim_token and d.status='processing';
  get diagnostics v_updated=row_count;
  return v_updated=1;
end;
$$;
revoke all on function public.finish_push_delivery(uuid,uuid,uuid,boolean,boolean,text) from public,anon,authenticated;
grant execute on function public.finish_push_delivery(uuid,uuid,uuid,boolean,boolean,text) to service_role;
