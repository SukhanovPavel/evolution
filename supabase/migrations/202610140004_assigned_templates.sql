-- Keep assigned template content readable after unpublishing, without allowing new enrollments.
drop policy published_templates on public.program_templates;
create policy published_templates on public.program_templates for select to authenticated using(published or exists(select 1 from public.user_programs u where u.template_id=program_templates.id and u.user_id=auth.uid()));
drop policy published_tasks on public.program_template_tasks;
create policy published_tasks on public.program_template_tasks for select to authenticated using(exists(select 1 from public.program_templates p where p.id=program_template_id));
create index assigned_template_owner on public.user_programs(template_id,user_id);
