\set ON_ERROR_STOP on
begin;
insert into auth.users(id) values('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
update profiles set timezone='UTC' where id=auth.uid();
do $$ begin
 if (select count(*) from profiles)<>1 then raise exception 'profile leak';end if;
 begin update profiles set role='admin' where id=auth.uid();raise exception 'ROLE ESCALATION';exception when raise_exception then if sqlerrm='ROLE ESCALATION' then raise;end if;end;
 begin insert into profiles(id,role) values('33333333-3333-4333-8333-333333333333','admin');raise exception 'PROFILE INJECTION';exception when insufficient_privilege then null;end;
 begin insert into daily_checkins(user_id,local_date,energy,difficulty) values('22222222-2222-4222-8222-222222222222',current_date,3,3);raise exception 'FOREIGN WRITE';exception when insufficient_privilege then null;end;
 begin update recipes set title='HACK' where active; if found then raise exception 'CATALOG WRITE';end if;end;
 if (select count(*) from recipes)<>24 then raise exception 'seed recipes';end if;
end $$;
select public.complete_onboarding('{"display_name":"A","timezone":"UTC","age_range":""}'::jsonb,'{"nutrition_track":"healthy","goals":["energy"],"time_budget_minutes":15,"activity_level":"beginner","equipment":["none"],"excluded_exercises":[],"food_allergies":[],"limitations":"","cold_opt_in":false,"cold_safety_ack":false,"safety_ack":true,"preferred_local_time":"19:00","reminders_enabled":false}'::jsonb,(select id from program_templates where slug='starter-healthy'),(now() at time zone 'UTC')::date);
select public.save_preferences('{"nutrition_track":"vegetarian","goals":["energy"],"time_budget_minutes":10,"activity_level":"beginner","equipment":["none"],"excluded_exercises":[],"food_allergies":[],"limitations":"","cold_opt_in":false,"cold_safety_ack":false,"safety_ack":true,"preferred_local_time":"18:00","reminders_enabled":true}'::jsonb);
do $$ begin if (select nutrition_track from user_preferences where user_id=auth.uid())<>'vegetarian' then raise exception 'PREFERENCES';end if;if not exists(select 1 from user_programs u join program_templates t on t.id=u.template_id where u.user_id=auth.uid() and t.slug='starter-vegetarian') then raise exception 'TRACK SWITCH';end if;end $$;
select public.save_daily_plan((now() at time zone 'UTC')::date,'UTC','initial','[{"category":"recovery","title":"Rest","description":"Rest","estimated_minutes":1,"sort_order":0}]');
select public.save_daily_plan((now() at time zone 'UTC')::date,'UTC','initial','[{"category":"recovery","title":"Rest","description":"Rest","estimated_minutes":1,"sort_order":0}]');
do $$ begin if (select count(*) from daily_plans)<>1 or (select count(*) from daily_tasks)<>1 then raise exception 'IDEMPOTENCY';end if;end $$;
select set_config('evolution_test.plan_id',(select id::text from daily_plans limit 1),true);
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $$ begin
 if (select count(*) from daily_plans)<>0 or (select count(*) from daily_tasks)<>0 then raise exception 'PRIVATE DATA LEAK';end if;
 update daily_tasks set status='completed';if found then raise exception 'FOREIGN TASK UPDATE';end if;
 begin insert into daily_tasks(daily_plan_id,user_id,category,title,description,estimated_minutes,sort_order) values(current_setting('evolution_test.plan_id')::uuid,auth.uid(),'recovery','x','x',1,99);raise exception 'CHILD INJECTION';exception when foreign_key_violation then null;end;
end $$;
reset role;
update profiles set role='admin' where id='22222222-2222-4222-8222-222222222222';
set local role authenticated;
do $$ begin update recipes set title=title where active; if not found then raise exception 'ADMIN WRITE FAILED';end if;end $$;
reset role;
update program_templates set published=false where slug='starter-vegetarian';
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$ begin
 if not exists(select 1 from program_templates where slug='starter-vegetarian') then raise exception 'ASSIGNED TEMPLATE LOST';end if;
 if (select count(*) from program_template_tasks where program_template_id=(select id from program_templates where slug='starter-vegetarian'))<>120 then raise exception 'ASSIGNED TASKS LOST';end if;
 begin perform public.start_program((select id from program_templates where slug='starter-vegetarian'),current_date);raise exception 'UNPUBLISHED ENROLLMENT';exception when raise_exception then if sqlerrm='UNPUBLISHED ENROLLMENT' then raise;end if;end;
end $$;
reset role;
update profiles set role='user' where id='22222222-2222-4222-8222-222222222222';
set local role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $$ begin if exists(select 1 from program_templates where slug='starter-vegetarian') then raise exception 'UNASSIGNED TEMPLATE LEAK';end if;end $$;
reset role;
rollback;
\echo RLS, role protection, catalog permissions and plan idempotency passed.
