-- Keep exercise notifications conservative for exclusions and recent fatigue.
create or replace function public.claim_push_deliveries(p_secret text) returns jsonb
language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare result jsonb;begin
 perform evolution_private.require_push_secret(p_secret);
 if not pg_try_advisory_xact_lock(hashtextextended('evolution-push-worker',0)) then return '[]'::jsonb;end if;
 delete from evolution_private.push_deliveries where claimed_at<now()-interval '14 days';
 with users as (
  select s.*,p.timezone,now() at time zone p.timezone local_now,
   exists(select 1 from (select pain_flag,illness_flag from daily_checkins c where c.user_id=s.user_id and c.local_date>=((now() at time zone p.timezone)::date-7) order by local_date desc limit 3) c where c.pain_flag or c.illness_flag)
   or coalesce(nullif(u.limitations,''),'')<>''
   or coalesce(jsonb_array_length(u.excluded_exercises),0)>0
   or exists(select 1 from daily_checkins c where c.user_id=s.user_id
     and c.local_date>=((now() at time zone p.timezone)::date-1)
     and (c.energy<=2 or c.difficulty>=4)) recovery
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
  on conflict(subscription_id,event_key) do update set kind=excluded.kind,status='leased',attempts=push_deliveries.attempts+1,claimed_at=now()
   where push_deliveries.status<>'sent' and push_deliveries.attempts<3 and push_deliveries.claimed_at<now()-interval '5 minutes'
  returning id,subscription_id,event_key,kind
 ) select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'event_key',c.event_key,'kind',c.kind,'endpoint',s.endpoint,'keys',jsonb_build_object('p256dh',s.p256dh,'auth',s.auth))),'[]'::jsonb)
 into result from claimed c join push_subscriptions s on s.id=c.subscription_id;
 return result;
end $$;
