-- Web Push: owned subscriptions/settings, private worker credentials and delivery leases.
create schema if not exists evolution_private;
revoke all on schema evolution_private from public, anon, authenticated;
create table evolution_private.push_worker_config (singleton boolean primary key default true check(singleton), secret_hash text not null);
create table public.push_settings (
 user_id uuid primary key references auth.users on delete cascade,
 enabled boolean not null default false, food_enabled boolean not null default true,
 food_time time not null default '12:30', movement_enabled boolean not null default true,
 work_start time not null default '09:00', work_end time not null default '18:00',
 movement_interval integer not null default 60 check(movement_interval in (30,60,90,120)),
 weekdays_only boolean not null default true, check(work_start < work_end)
);
create table public.push_subscriptions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade,
 endpoint text not null unique check(length(endpoint)<=2048 and endpoint ~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)/'),
 p256dh text not null check(p256dh ~ '^[A-Za-z0-9_-]{87}=?$'),
 auth text not null check(auth ~ '^[A-Za-z0-9_-]{22}(==)?$'), created_at timestamptz not null default now()
);
create table evolution_private.push_deliveries (
 id uuid primary key default gen_random_uuid(), subscription_id uuid not null references public.push_subscriptions on delete cascade,
 event_key text not null, kind text not null, status text not null default 'leased' check(status in ('leased','sent','failed')),
 attempts integer not null default 1, claimed_at timestamptz not null default now(), unique(subscription_id,event_key)
);
alter table public.push_settings enable row level security;
alter table public.push_subscriptions enable row level security;
create policy push_settings_owned on public.push_settings for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy push_subscriptions_owned on public.push_subscriptions for select to authenticated using(user_id=auth.uid());
create policy push_subscriptions_delete on public.push_subscriptions for delete to authenticated using(user_id=auth.uid());
revoke all on public.push_settings, public.push_subscriptions from anon, authenticated;
grant select,insert,update,delete on public.push_settings to authenticated;
grant select,delete on public.push_subscriptions to authenticated;
create function public.register_push_subscription(p_endpoint text,p_p256dh text,p_auth text) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid; begin
 if auth.uid() is null then raise exception 'UNAUTHORIZED';end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,1));
 if exists(select 1 from push_subscriptions where endpoint=p_endpoint and user_id<>auth.uid()) then raise exception 'SUBSCRIPTION_CONFLICT';end if;
 if not exists(select 1 from push_subscriptions where endpoint=p_endpoint and user_id=auth.uid()) and (select count(*) from push_subscriptions where user_id=auth.uid())>=10 then raise exception 'DEVICE_LIMIT';end if;
 insert into push_subscriptions(user_id,endpoint,p256dh,auth) values(auth.uid(),p_endpoint,p_p256dh,p_auth)
 on conflict(endpoint) do update set p256dh=excluded.p256dh,auth=excluded.auth where push_subscriptions.user_id=auth.uid() returning id into result;
 return result;
end $$;
revoke all on function public.register_push_subscription(text,text,text) from public,anon;
grant execute on function public.register_push_subscription(text,text,text) to authenticated;
create function evolution_private.require_push_secret(p_secret text) returns void
language plpgsql security definer set search_path=public,extensions,pg_temp as $$ begin
 if p_secret is null or length(p_secret)<32 or not exists(select 1 from evolution_private.push_worker_config where secret_hash=encode(digest(p_secret,'sha256'),'hex')) then raise exception 'UNAUTHORIZED';end if;
end $$;
revoke all on function evolution_private.require_push_secret(text) from public,anon,authenticated;
create function public.claim_push_deliveries(p_secret text) returns jsonb
language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare result jsonb;begin
 perform evolution_private.require_push_secret(p_secret);
 if not pg_try_advisory_xact_lock(hashtextextended('evolution-push-worker',0)) then return '[]'::jsonb;end if;
 delete from evolution_private.push_deliveries where claimed_at<now()-interval '14 days';
 with users as (
  select s.*,p.timezone,now() at time zone p.timezone local_now,
   exists(select 1 from (select pain_flag,illness_flag from daily_checkins c where c.user_id=s.user_id and c.local_date>=((now() at time zone p.timezone)::date-7) order by local_date desc limit 3) c where c.pain_flag or c.illness_flag)
   or coalesce(nullif(u.limitations,''),'')<>'' recovery
  from push_settings s join profiles p on p.id=s.user_id left join user_preferences u on u.user_id=s.user_id where s.enabled
 ), events as (
  select user_id,local_now,'food' kind,local_now::date+food_time due from users where food_enabled
  union all
  select u.user_id,u.local_now,case when recovery then 'rest' else 'movement' end,
   u.local_now::date+u.work_start+(n*u.movement_interval)*interval '1 minute'
  from users u cross join generate_series(1,48) n
  where movement_enabled and (not weekdays_only or extract(isodow from local_now) between 1 and 5)
   and u.work_start+(n*u.movement_interval)*interval '1 minute'<u.work_end
 ), candidates as (
  select sub.id subscription_id,e.kind,to_char(e.due,'YYYY-MM-DD:HH24:MI')||':'||case when e.kind='rest' then 'movement' else e.kind end event_key
  from events e join push_subscriptions sub on sub.user_id=e.user_id
  where e.due<=e.local_now and e.due>e.local_now-interval '15 minutes'
  and not exists(select 1 from evolution_private.push_deliveries d where d.subscription_id=sub.id and d.event_key=to_char(e.due,'YYYY-MM-DD:HH24:MI')||':'||case when e.kind='rest' then 'movement' else e.kind end and (d.status='sent' or d.attempts>=3 or d.claimed_at>=now()-interval '5 minutes'))
  order by e.due,sub.id limit 50
 ), claimed as (
  insert into evolution_private.push_deliveries(subscription_id,event_key,kind)
  select subscription_id,event_key,kind from candidates
  on conflict(subscription_id,event_key) do update set status='leased',attempts=push_deliveries.attempts+1,claimed_at=now()
   where push_deliveries.status<>'sent' and push_deliveries.attempts<3 and push_deliveries.claimed_at<now()-interval '5 minutes'
  returning id,subscription_id,event_key,kind
 ) select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'event_key',c.event_key,'kind',c.kind,'endpoint',s.endpoint,'keys',jsonb_build_object('p256dh',s.p256dh,'auth',s.auth))),'[]'::jsonb)
 into result from claimed c join push_subscriptions s on s.id=c.subscription_id;
 return result;
end $$;
create function public.finish_push_delivery(p_secret text,p_id uuid,p_result text) returns void
language plpgsql security definer set search_path=public,pg_temp as $$ begin
 perform evolution_private.require_push_secret(p_secret);
 if p_result='expired' then delete from push_subscriptions where id=(select subscription_id from evolution_private.push_deliveries where id=p_id);
 elsif p_result in ('sent','failed') then update evolution_private.push_deliveries set status=p_result where id=p_id;
 else raise exception 'INVALID_RESULT';end if;
end $$;
revoke all on function public.claim_push_deliveries(text),public.finish_push_delivery(text,uuid,text) from public,anon,authenticated;
grant execute on function public.claim_push_deliveries(text),public.finish_push_delivery(text,uuid,text) to anon;
notify pgrst,'reload schema';
