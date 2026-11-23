alter table public.user_preferences drop constraint user_preferences_activity_level_check;
alter table public.user_preferences add constraint user_preferences_activity_level_check
  check (activity_level in ('beginner', 'intermediate', 'advanced'));

alter table public.user_programs add column cycle integer not null default 1 check (cycle > 0);

create function public.continue_program(p_previous uuid) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  owner_id uuid := auth.uid();
  previous public.user_programs%rowtype;
  next_id uuid;
  today date;
begin
  if owner_id is null then return null; end if;
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text, 0));
  select * into previous from public.user_programs
    where user_id = owner_id order by created_at desc, cycle desc, id desc limit 1;
  select (now() at time zone timezone)::date into today from public.profiles where id = owner_id;
  if previous.id is null or previous.id is distinct from p_previous or today is null or today < previous.start_date + 30 then
    return null;
  end if;
  update public.user_programs set status = 'completed' where user_id = owner_id and id = previous.id;
  insert into public.user_programs(user_id, template_id, start_date, status, cycle)
    values (owner_id, previous.template_id, today, 'active', previous.cycle + 1)
    returning id into next_id;
  return next_id;
end $$;
revoke all on function public.continue_program(uuid) from public, anon;
grant execute on function public.continue_program(uuid) to authenticated;

create table public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  local_date date not null,
  weight_kg numeric(5,1) check (weight_kg between 20 and 500),
  chest_cm numeric(5,1) check (chest_cm between 20 and 350),
  waist_cm numeric(5,1) check (waist_cm between 20 and 350),
  hips_cm numeric(5,1) check (hips_cm between 20 and 350),
  check (num_nonnulls(weight_kg, chest_cm, waist_cm, hips_cm) > 0),
  unique (user_id, local_date)
);
alter table public.body_measurements enable row level security;
create policy own_rows on public.body_measurements for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.body_measurements to authenticated;
create or replace function public.delete_my_data() returns void
language plpgsql security invoker set search_path = public as $$
begin
  delete from body_measurements where user_id = auth.uid();
  delete from habit_events where user_id = auth.uid();
  delete from daily_checkins where user_id = auth.uid();
  delete from daily_plans where user_id = auth.uid();
  delete from user_programs where user_id = auth.uid();
  delete from user_recipe_favorites where user_id = auth.uid();
  delete from notification_preferences where user_id = auth.uid();
  delete from user_preferences where user_id = auth.uid();
  update profiles set display_name = '', age_range = '' where id = auth.uid();
end $$;

alter table public.push_settings alter column movement_enabled set default false;

insert into public.exercises(
  id, slug, title, difficulty, description, instructions, easier, harder, equipment, category, common_mistakes, warnings, reps, seconds, rest_seconds, media_url, active
) values
  ('c469e07c-ef50-4cb0-b617-6cb0574e9ac0', 'prone-row', 'Тяга локтей лёжа', 'beginner', 'Мягкая работа верхней части спины без оборудования.', '["Лягте на живот и смотрите в пол, держите шею прямо", "Согните руки и плавно ведите локти к рёбрам, слегка отрывая руки от пола", "Опустите руки без прогиба в пояснице"]', 'Выполните то же движение стоя без отягощения.', 'Задержите локти у корпуса на одну секунду.', '["none"]', 'activity', 'Рывки, задержка дыхания и напряжение шеи.', 'При боли остановитесь.', 8, 30, 30, null, true),
  ('fc0385f5-a46a-4f75-ac26-83ff68d72db2', 'band-row', 'Тяга резинки сидя', 'intermediate', 'Тяга для спины с лёгкой длинной эластичной лентой.', '["Сядьте на пол с немного согнутыми коленями и разместите целую ленту на середине подошв в обуви", "Возьмите концы, держите спину ровно и подтяните локти к рёбрам", "Медленно выпрямите руки, удерживая натяжение под контролем"]', 'Возьмите более лёгкую ленту или сделайте тягу локтей лёжа.', 'Задержитесь на секунду с локтями у рёбер.', '["bands"]', 'activity', 'Рывки, задержка дыхания и напряжение шеи.', 'Проверьте ленту и её положение перед подходом. При соскальзывании опустите руки и прекратите подход.', 8, 30, 30, null, true),
  ('5598857e-da39-4765-8115-2ab5c4814877', 'floor-push', 'Отжимания от пола', 'intermediate', 'Силовое движение для груди, плеч и рук.', '["Поставьте ладони немного шире плеч, опирайтесь на носки", "Согните руки и опуститесь на удобную глубину, сохраняя ровную линию корпуса", "Плавно выжмите себя вверх на выдохе"]', 'Перейдите на колени или к отжиманиям от стены.', 'Замедлите опускание, пока техника остаётся уверенной.', '["none"]', 'activity', 'Рывки, задержка дыхания и напряжение шеи.', 'При боли остановитесь.', 8, 30, 30, null, true)
on conflict (slug) do nothing;
