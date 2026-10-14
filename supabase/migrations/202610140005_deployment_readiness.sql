-- Explicit grants: do not depend on project default privileges.
grant usage on schema public to authenticated,anon;
grant select,insert,update,delete on public.user_preferences,public.notification_preferences,public.user_programs,public.daily_plans,public.daily_tasks,public.daily_checkins,public.user_recipe_favorites,public.habit_events,public.program_templates,public.program_template_tasks,public.recipes,public.exercises,public.routines,public.routine_exercises to authenticated;
grant select,update on public.profiles to authenticated;
revoke insert,delete on public.profiles from authenticated;
revoke all on public.profiles,public.user_preferences,public.notification_preferences,public.user_programs,public.daily_plans,public.daily_tasks,public.daily_checkins,public.user_recipe_favorites,public.habit_events,public.program_templates,public.program_template_tasks,public.recipes,public.exercises,public.routines,public.routine_exercises from anon;
-- Only this constant/aggregate status can be read without a session. No user data.
create function public.deployment_readiness() returns jsonb language sql stable security definer set search_path=public as $$
 select jsonb_build_object(
 'schema_version',5,
 'catalog_ready',(select count(*)>=24 from recipes where active) and (select count(*)>=30 from exercises where active) and (select count(*)>=8 from routines where active) and (select count(*)>=3 from program_templates where published) and (select count(*)>=360 from program_template_tasks),
 'rls_ready',(select count(*)=15 and bool_and(c.relrowsecurity) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=any(array['profiles','user_preferences','notification_preferences','user_programs','daily_plans','daily_tasks','daily_checkins','user_recipe_favorites','habit_events','program_templates','program_template_tasks','recipes','exercises','routines','routine_exercises'])),
 'profile_trigger_ready',exists(select 1 from pg_trigger where tgrelid='auth.users'::regclass and tgname='new_user' and tgenabled<>'D')
 );
$$;
revoke all on function public.deployment_readiness() from public;
grant execute on function public.deployment_readiness() to anon,authenticated;
notify pgrst,'reload schema';
