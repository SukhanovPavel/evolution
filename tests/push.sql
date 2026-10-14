\set ON_ERROR_STOP on
begin;
insert into auth.users(id) values('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
update profiles set timezone='UTC' where id in ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222');
insert into evolution_private.push_worker_config(singleton,secret_hash) values(true,encode(digest(repeat('test',16),'sha256'),'hex')) on conflict(singleton) do update set secret_hash=excluded.secret_hash;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
insert into push_settings(user_id,enabled,food_time,movement_enabled) values(auth.uid(),true,date_trunc('minute',now() at time zone 'UTC')::time,false);
select register_push_subscription('https://fcm.googleapis.com/fcm/send/evolution-test-a',repeat('A',87),repeat('B',22));
do $$ begin
 begin insert into push_settings(user_id) values('22222222-2222-4222-8222-222222222222');raise exception 'FOREIGN PUSH SETTINGS';exception when insufficient_privilege then null;end;
 begin perform register_push_subscription('https://127.0.0.1/internal',repeat('A',87),repeat('B',22));raise exception 'PUSH SSRF';exception when check_violation then null;end;
 begin perform claim_push_deliveries(repeat('test',16));raise exception 'USER WORKER ACCESS';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $$ begin
 if exists(select 1 from push_subscriptions) or exists(select 1 from push_settings) then raise exception 'PUSH DATA LEAK';end if;
 delete from push_subscriptions;if found then raise exception 'FOREIGN PUSH DELETE';end if;
 begin perform register_push_subscription('https://fcm.googleapis.com/fcm/send/evolution-test-a',repeat('A',87),repeat('B',22));raise exception 'SUBSCRIPTION THEFT';exception when raise_exception then if sqlerrm='SUBSCRIPTION THEFT' then raise;end if;end;
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform claim_push_deliveries(repeat('wrong',16));raise exception 'BAD WORKER SECRET';exception when raise_exception then if sqlerrm='BAD WORKER SECRET' then raise;end if;end;
end $$;
-- Temporarily exclude real subscriptions from this rollback-only test.
reset role;
update push_settings set enabled=false where user_id not in ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222');
set local role anon;
do $$ declare jobs jsonb;did uuid; begin
 jobs:=claim_push_deliveries(repeat('test',16));
 if jsonb_array_length(jobs)<>1 or jobs->0->>'kind'<>'food' then raise exception 'PUSH SCHEDULE';end if;
 did:=(jobs->0->>'id')::uuid;
 if jsonb_array_length(claim_push_deliveries(repeat('test',16)))<>0 then raise exception 'PUSH DUPLICATE LEASE';end if;
 perform finish_push_delivery(repeat('test',16),did,'sent');
 if jsonb_array_length(claim_push_deliveries(repeat('test',16)))<>0 then raise exception 'PUSH DUPLICATE SENT';end if;
 perform finish_push_delivery(repeat('test',16),did,'expired');
end $$;
reset role;
do $$ begin if exists(select 1 from push_subscriptions where endpoint='https://fcm.googleapis.com/fcm/send/evolution-test-a') then raise exception 'EXPIRED SUBSCRIPTION';end if;end $$;
rollback;
\echo Push ownership, worker authorization, schedule, deduplication and expiry passed.
begin;
insert into auth.users(id) values('11111111-1111-4111-8111-111111111111');
-- Set the user's timezone so the local clock is always around noon, independently of CI time.
update profiles set timezone='Etc/GMT'||case when extract(hour from now() at time zone 'UTC')::int-12>=0 then '+' else '-' end||abs(extract(hour from now() at time zone 'UTC')::int-12)::text where id='11111111-1111-4111-8111-111111111111';
insert into evolution_private.push_worker_config(singleton,secret_hash) values(true,encode(digest(repeat('test',16),'sha256'),'hex')) on conflict(singleton) do update set secret_hash=excluded.secret_hash;
update push_settings set enabled=false;
insert into push_settings(user_id,enabled,food_enabled,movement_enabled,work_start,work_end,movement_interval,weekdays_only)
select id,true,false,true,(date_trunc('minute',now() at time zone timezone)-interval '1 hour')::time,(date_trunc('minute',now() at time zone timezone)+interval '2 hours')::time,60,false from profiles where id='11111111-1111-4111-8111-111111111111';
insert into push_subscriptions(user_id,endpoint,p256dh,auth) values('11111111-1111-4111-8111-111111111111','https://fcm.googleapis.com/fcm/send/evolution-test-rest',repeat('A',87),repeat('B',22));
insert into daily_checkins(user_id,local_date,energy,difficulty,pain_flag,illness_flag) select id,(now() at time zone timezone)::date,3,3,true,false from profiles where id='11111111-1111-4111-8111-111111111111';
set local role anon;
do $$ declare jobs jsonb; begin
 jobs:=claim_push_deliveries(repeat('test',16));
 if jsonb_array_length(jobs)<>1 or jobs->0->>'kind'<>'rest' then raise exception 'PUSH SAFETY/TIMEZONE';end if;
end $$;
reset role;
delete from evolution_private.push_deliveries where subscription_id in(select id from push_subscriptions where user_id='11111111-1111-4111-8111-111111111111');
update push_settings s set work_end=(select (date_trunc('minute',now() at time zone p.timezone)-interval '15 minutes')::time from profiles p where p.id=s.user_id) where s.user_id='11111111-1111-4111-8111-111111111111';
set local role anon;
do $$ begin if jsonb_array_length(claim_push_deliveries(repeat('test',16)))<>0 then raise exception 'PUSH OUTSIDE WORK HOURS';end if;end $$;
reset role;
rollback;
\echo Push timezone, conservative recovery and work window passed.
