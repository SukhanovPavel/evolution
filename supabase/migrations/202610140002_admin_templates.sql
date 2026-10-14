create function public.save_template(p_id uuid,p_template jsonb,p_tasks jsonb) returns uuid language plpgsql security invoker set search_path=public as $$
declare target uuid; item jsonb; begin
 if not public.is_admin() then raise exception 'admin required'; end if;
 if p_id is null then
 insert into program_templates(slug,title,category,difficulty,duration_days,published) values(p_template->>'slug',p_template->>'title',p_template->>'category',p_template->>'difficulty',30,(p_template->>'published')::boolean) returning id into target;
 else target:=p_id;update program_templates set slug=p_template->>'slug',title=p_template->>'title',category=p_template->>'category',difficulty=p_template->>'difficulty',published=(p_template->>'published')::boolean where id=target;if not found then raise exception 'not found';end if;delete from program_template_tasks where program_template_id=target;end if;
 for item in select value from jsonb_array_elements(p_tasks) loop insert into program_template_tasks(program_template_id,day_number,task_type,payload,estimated_minutes,sort_order) values(target,(item->>'day_number')::int,item->>'task_type',item->'payload',(item->>'estimated_minutes')::int,(item->>'sort_order')::int);end loop;return target;end $$;
revoke all on function public.save_template(uuid,jsonb,jsonb) from public,anon;grant execute on function public.save_template(uuid,jsonb,jsonb) to authenticated;
